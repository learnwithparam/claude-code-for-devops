// Reads one copy of the world and says, for each planted fault, whether it is still there.
// Every answer comes from the repo files and the world state, never from what an agent said.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { plan, repoDir, loadCluster, readLog } from "../sim/state";

export type Fault = { id: string; name: string; fixed: boolean; evidence: string; part: string };
const yaml = (p: string) => (existsSync(p) ? (Bun.YAML.parse(readFileSync(p, "utf8")) as any) : null);
const text = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

export function faults(home: string): Fault[] {
  const repo = repoDir(home);
  const out: Fault[] = [];

  let drift = "";
  try {
    const ch = plan("prod", home);
    drift = ch.length ? `plan on prod shows ${ch.length} change(s): ${ch.map((c) => c.address).join(", ")}` : "";
  } catch (e) { drift = `the Terraform code does not parse: ${(e as Error).message}`; }
  out.push({ id: "drift", name: "Drift on the buyer records bucket", fixed: !drift, evidence: drift || "plan on prod shows no changes", part: "teach-the-repo" });

  const v = yaml(join(repo, "charts", "seat-api", "values.yaml")) ?? {};
  const chartProblems = [
    v.image?.tag === "latest" || !v.image?.tag ? "image tag is latest" : "",
    !v.resources?.limits?.memory || !v.resources?.limits?.cpu ? "no resource limits" : "",
    Number(v.probe?.port) !== Number(v.containerPort) ? `probe port ${v.probe?.port} is not container port ${v.containerPort}` : "",
  ].filter(Boolean);
  const pods = loadCluster("dev", home).releases["seat-api"]?.values;
  const crashing = pods ? Number(pods.probe?.port) !== Number(pods.containerPort) : true;
  out.push({
    id: "chart", name: "Bad seat-api Helm chart", part: "teach-the-repo",
    fixed: chartProblems.length === 0 && !crashing,
    evidence: chartProblems.length ? chartProblems.join("; ") : crashing ? "chart is fixed but dev still runs the crashing release" : "chart passes and dev pods are Running",
  });

  const rules = yaml(join(repo, "alerts", "seat.rules.yml"));
  const slow = rules?.groups?.flatMap((g: any) => g.rules).find((r: any) => r.alert === "SeatApiSlow");
  const forMin = Number(String(slow?.for ?? "0m").replace(/m$/, "")) || 0;
  const noisy = !slow || /histogram_quantile\(0\.5\b/.test(slow.expr) || forMin < 5;
  out.push({ id: "alert", name: "Noisy SeatApiSlow alert", part: "give-it-eyes", fixed: !noisy, evidence: noisy ? `SeatApiSlow uses ${/0\.5\b/.test(slow?.expr ?? "") ? "p50" : "its query"} with for: ${slow?.for ?? "missing"}` : "p99 with a hold of 5m or more" });

  const mod = text(join(repo, "terraform", "modules", "scan-store", "main.tf"));
  const lifecycle = /resource\s+"aws_s3_bucket_lifecycle_configuration"/.test(mod) && /days\s*=\s*([1-9]|[12]\d|30)\b/.test(mod);
  const hpa = yaml(join(repo, "k8s", "scan-telemetry-hpa.yaml"));
  const minR = Number(hpa?.spec?.minReplicas ?? 0);
  const costProblems = [!lifecycle ? "no lifecycle rule expiring scan readings within 30 days" : "", minR > 3 ? `scan-telemetry autoscaler minimum is ${minR}` : ""].filter(Boolean);
  out.push({ id: "cost", name: "Cost spike on scan telemetry", part: "give-it-eyes", fixed: costProblems.length === 0, evidence: costProblems.join("; ") || "lifecycle rule in code and autoscaler minimum is 3 or less" });

  const ci = text(join(repo, ".github", "workflows", "ci.yml"));
  const unpinned = [...ci.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1]).filter((u) => !/@[0-9a-f]{40}$/.test(u));
  const tflint = /required_providers/.test(mod);
  const ciProblems = [unpinned.length ? `${unpinned.length} action(s) not pinned to a commit SHA` : "", !tflint ? "tflint: scan-store module has no required_providers" : ""].filter(Boolean);
  out.push({ id: "ci", name: "Failing CI pipeline", part: "run-it-without-you", fixed: ciProblems.length === 0, evidence: ciProblems.join("; ") || "every action pinned and tflint clean" });
  return out;
}

// The last guard suite run, read from the log the checker writes.
export type GuardScore = { dangerous: [number, number]; bypass: [number, number]; safe: [number, number]; malformed: boolean; ran: boolean };
export function guardScore(home: string): GuardScore {
  const runs = readLog("guard.jsonl", home);
  // Runs of the sample solutions and wrong answers (by bun run check) do not count as yours.
  const last = runs.filter((r) => r.kind === "summary" && !/\/(solution|wrong)(\/|$)/.test(r.source ?? "")).pop();
  if (!last) return { dangerous: [0, 20], bypass: [0, 10], safe: [0, 15], malformed: false, ran: false };
  return { ...last.score, ran: true };
}

export const mutatingByAgent = (home: string) => readLog("commands.jsonl", home).filter((e) => e.mutating && e.actor !== "ops-oncall" && e.actor !== "person");
export const listFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir) : []);
