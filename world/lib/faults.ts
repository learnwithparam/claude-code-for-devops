// Reads one copy of the world and says, for each planted fault, whether it is still there.
// Every answer comes from the repo files and the world state, never from what an agent said.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCluster, plan, readLog, repoDir } from "../sim/state";

export type Fault = { id: string; name: string; fixed: boolean; evidence: string; part: string };

// The parts of the YAML files that the checks below look at.
type Ports = { containerPort?: unknown; probe?: { port?: unknown } };
type ChartValues = Ports & {
  image?: { tag?: string };
  resources?: { limits?: { memory?: string; cpu?: string } };
};
type AlertRule = { alert?: string; expr?: string; for?: string };
type AlertRules = { groups?: { rules: AlertRule[] }[] };
type Autoscaler = { spec?: { minReplicas?: number } };

function readYaml<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return Bun.YAML.parse(readFileSync(path, "utf8")) as T;
}
const readText = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

// Keeps only the problems that are there: an empty string means "no problem".
const realProblems = (problems: string[]) => problems.filter(Boolean);

function driftProblem(home: string): string {
  try {
    const changes = plan("prod", home);
    if (!changes.length) return "";
    const addresses = changes.map((change) => change.address).join(", ");
    return `plan on prod shows ${changes.length} change(s): ${addresses}`;
  } catch (error) {
    return `the Terraform code does not parse: ${(error as Error).message}`;
  }
}

function driftFault(home: string): Fault {
  const drift = driftProblem(home);
  return {
    id: "drift",
    name: "Drift on the buyer records bucket",
    fixed: !drift,
    evidence: drift || "plan on prod shows no changes",
    part: "teach-the-repo",
  };
}

const portsDiffer = (ports: Ports) => Number(ports.probe?.port) !== Number(ports.containerPort);

function chartProblems(values: ChartValues): string[] {
  const tag = values.image?.tag;
  const limits = values.resources?.limits;
  const portProblem = `probe port ${values.probe?.port} is not container port ${values.containerPort}`;
  return realProblems([
    tag === "latest" || !tag ? "image tag is latest" : "",
    !limits?.memory || !limits?.cpu ? "no resource limits" : "",
    portsDiffer(values) ? portProblem : "",
  ]);
}

function chartFault(home: string, repo: string): Fault {
  const valuesFile = join(repo, "charts", "seat-api", "values.yaml");
  const problems = chartProblems(readYaml<ChartValues>(valuesFile) ?? {});
  // The pods run what was last deployed to dev, which may not be what the chart says now.
  const deployedValues = loadCluster("dev", home).releases["seat-api"]?.values;
  const crashing = deployedValues ? portsDiffer(deployedValues) : true;
  let evidence = "chart passes and dev pods are Running";
  if (problems.length) evidence = problems.join("; ");
  else if (crashing) evidence = "chart is fixed but dev still runs the crashing release";
  return {
    id: "chart",
    name: "Bad seat-api Helm chart",
    part: "teach-the-repo",
    fixed: problems.length === 0 && !crashing,
    evidence,
  };
}

function findSlowAlert(repo: string): AlertRule | undefined {
  const rulesFile = readYaml<AlertRules>(join(repo, "alerts", "seat.rules.yml"));
  const allRules = rulesFile?.groups?.flatMap((group) => group.rules);
  return allRules?.find((rule) => rule.alert === "SeatApiSlow");
}

function alertFault(repo: string): Fault {
  const slow = findSlowAlert(repo);
  const holdMinutes = Number(String(slow?.for ?? "0m").replace(/m$/, "")) || 0;
  const usesMedian = (query: string) => /histogram_quantile\(0\.5\b/.test(query);
  const noisy = !slow || usesMedian(String(slow.expr)) || holdMinutes < 5;
  const queryName = /0\.5\b/.test(slow?.expr ?? "") ? "p50" : "its query";
  let evidence = "p99 with a hold of 5m or more";
  if (noisy) evidence = `SeatApiSlow uses ${queryName} with for: ${slow?.for ?? "missing"}`;
  return {
    id: "alert",
    name: "Noisy SeatApiSlow alert",
    part: "give-it-eyes",
    fixed: !noisy,
    evidence,
  };
}

const scanStoreModule = (repo: string) =>
  readText(join(repo, "terraform", "modules", "scan-store", "main.tf"));

function costFault(repo: string): Fault {
  const moduleCode = scanStoreModule(repo);
  const lifecycle =
    /resource\s+"aws_s3_bucket_lifecycle_configuration"/.test(moduleCode) &&
    /days\s*=\s*([1-9]|[12]\d|30)\b/.test(moduleCode);
  const autoscaler = readYaml<Autoscaler>(join(repo, "k8s", "scan-telemetry-hpa.yaml"));
  const minReplicas = Number(autoscaler?.spec?.minReplicas ?? 0);
  const problems = realProblems([
    !lifecycle ? "no lifecycle rule expiring old scan readings" : "",
    minReplicas > 3 ? `scan-telemetry autoscaler minimum is ${minReplicas}` : "",
  ]);
  return {
    id: "cost",
    name: "Cost spike on scan telemetry",
    part: "give-it-eyes",
    fixed: problems.length === 0,
    evidence: problems.join("; ") || "lifecycle rule in code and autoscaler minimum is 3 or less",
  };
}

// The actions in a workflow that are not pinned to a full 40-character commit SHA.
function unpinnedActions(workflow: string): string[] {
  const usesLines = [...workflow.matchAll(/uses:\s*([^\s#]+)/g)];
  const actions = usesLines.map((match) => match[1]);
  return actions.filter((action) => !/@[0-9a-f]{40}$/.test(action));
}

function ciFault(repo: string): Fault {
  const workflow = readText(join(repo, ".github", "workflows", "ci.yml"));
  const unpinned = unpinnedActions(workflow);
  const tflintClean = /required_providers/.test(scanStoreModule(repo));
  const problems = realProblems([
    unpinned.length ? `${unpinned.length} action(s) not pinned to a commit SHA` : "",
    !tflintClean ? "tflint: scan-store module has no required_providers" : "",
  ]);
  return {
    id: "ci",
    name: "Failing CI pipeline",
    part: "run-it-without-you",
    fixed: problems.length === 0,
    evidence: problems.join("; ") || "every action pinned and tflint clean",
  };
}

export function faults(home: string): Fault[] {
  const repo = repoDir(home);
  return [
    driftFault(home),
    chartFault(home, repo),
    alertFault(repo),
    costFault(repo),
    ciFault(repo),
  ];
}

// The last guard suite run, read from the log the checker writes.
export type GuardScore = {
  dangerous: [number, number];
  bypass: [number, number];
  safe: [number, number];
  malformed: boolean;
  ran: boolean;
};
export function guardScore(home: string): GuardScore {
  const runs = readLog("guard.jsonl", home);
  // Runs of the sample solutions and wrong answers (by bun run check) do not count as yours.
  const isYours = (run: { kind?: string; source?: string }) =>
    run.kind === "summary" && !/\/(solution|wrong)(\/|$)/.test(run.source ?? "");
  const last = runs.filter(isYours).pop();
  if (!last)
    return { dangerous: [0, 20], bypass: [0, 10], safe: [0, 15], malformed: false, ran: false };
  return { ...last.score, ran: true };
}

// The commands that changed the world and were not run by a person.
export const mutatingByAgent = (home: string) =>
  readLog("commands.jsonl", home).filter(
    (entry) => entry.mutating && entry.actor !== "ops-oncall" && entry.actor !== "person",
  );
export const listFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir) : []);
