// The practice world's terraform, tofu, kubectl, helm and aws.
// Each acts on the world's state, not a real cloud. Run through the shims in world/bin.
// Every call is logged; calls that change state are marked mutating.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  applyPlan,
  type Change,
  type Cloud,
  type Cluster,
  type Env,
  instance,
  loadCloud,
  loadCluster,
  log,
  plan,
  type Release,
  type Resource,
  saveCloud,
  saveCluster,
} from "./state";

const [tool, ...toolArguments] = process.argv.slice(2);

function print(text = "") {
  console.log(text);
}

function printError(text: string) {
  console.error(text);
}

function finish(exitCode: number): never {
  return process.exit(exitCode);
}

function record(mutating: boolean, env: Env | null, details: Record<string, unknown> = {}) {
  log({
    tool,
    args: toolArguments,
    cwd: relative(instance(), process.cwd()) || ".",
    env,
    mutating,
    ...details,
  });
}

// The value after a flag, written either as "--name value" or as "--name=value".
function flagValue(args: string[], ...names: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    for (const name of names) {
      if (args[i] === name) return args[i + 1];
      if (args[i].startsWith(`${name}=`)) return args[i].slice(name.length + 1);
    }
  }
  return undefined;
}

function hasFlag(args: string[], ...names: string[]): boolean {
  return args.some((argument) => names.includes(argument));
}

// The arguments that are not flags. Flags named in flagsWithValue also skip the word after them.
function positionalArguments(args: string[], flagsWithValue: string[] = []): string[] {
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("-")) {
      if (flagsWithValue.includes(args[i])) i++;
      continue;
    }
    positional.push(args[i]);
  }
  return positional;
}

// A context or profile name says which environment it points at.
function environmentFor(name: string | undefined): Env | null {
  if (name?.includes("dev")) return "dev";
  if (name?.includes("prod")) return "prod";
  return null;
}

function prettyJson(content: unknown): string {
  return JSON.stringify(content, null, 2);
}

// ---------- terraform and tofu ----------

type TerraformRun = {
  command: string;
  options: string[];
  env: Env;
  home: string;
  folder: string;
  productName: string;
};

function terraform(givenArguments: string[]) {
  let args = givenArguments;
  let folder = process.cwd();
  const chdir = args.find((argument) => argument.startsWith("-chdir="));
  if (chdir) {
    folder = resolve(folder, chdir.slice("-chdir=".length));
    args = args.filter((argument) => argument !== chdir);
  }
  const [command, ...options] = args;
  const envMatch = folder.match(/terraform\/envs\/(dev|prod)\/?$/);
  const env = (envMatch?.[1] as Env) ?? null;
  const productName = tool === "tofu" ? "OpenTofu" : "Terraform";
  if (!command || command === "version" || command === "-version") {
    print(`${productName} v1.17.2 (practice world)`);
    return finish(0);
  }
  if (!env) {
    record(false, null);
    printError(
      `Error: No configuration files. Run ${tool} from terraform/envs/dev or ` +
        "terraform/envs/prod, or pass -chdir.",
    );
    return finish(1);
  }
  const run: TerraformRun = { command, options, env, home: instance(), folder, productName };
  runTerraformCommand(run);
  record(false, env);
  printError(
    `${tool} ${command}: not part of the practice world. Supported: init, validate, fmt, ` +
      "plan, show, apply, destroy, state list, state rm.",
  );
  return finish(1);
}

// Runs the command and exits. Returns only when the command is not one the world supports.
function runTerraformCommand(run: TerraformRun) {
  const handler = TERRAFORM_COMMANDS.get(run.command);
  if (!handler) return;
  try {
    handler(run);
  } catch (error) {
    const message = (error as Error).message;
    record(false, run.env, { error: message });
    printError(`Error: ${message}`);
    finish(1);
  }
}

const TERRAFORM_COMMANDS = new Map<string, (run: TerraformRun) => void>([
  ["init", terraformInit],
  ["validate", terraformValidate],
  ["fmt", terraformFormat],
  ["plan", terraformPlan],
  ["show", terraformShow],
  ["apply", terraformApply],
  ["destroy", terraformApply],
  ["state", terraformState],
]);

function terraformInit(run: TerraformRun) {
  record(false, run.env);
  print(`${run.productName} has been successfully initialized!`);
  finish(0);
}

function terraformValidate(run: TerraformRun) {
  record(false, run.env);
  plan(run.env, run.home);
  print("Success! The configuration is valid.");
  finish(0);
}

function terraformFormat(run: TerraformRun) {
  record(false, run.env);
  finish(0);
}

function terraformPlan(run: TerraformRun) {
  const changes = plan(run.env, run.home, hasFlag(run.options, "-destroy"));
  const planText = `${prettyJson(planJson(run.env, changes))}\n`;
  const logsFolder = join(run.home, "logs");
  mkdirSync(logsFolder, { recursive: true });
  writeFileSync(join(logsFolder, `plan-${run.env}.json`), planText);
  const outOption = run.options.find((option) => option.startsWith("-out="));
  if (outOption) {
    writeFileSync(resolve(run.folder, outOption.slice("-out=".length)), planText);
  }
  record(false, run.env, { changes: changes.length });
  printChanges(changes);
  const wantsDetailedExitCode = hasFlag(run.options, "-detailed-exitcode");
  // With -detailed-exitcode, exit code 2 means "the plan has changes", as in real Terraform.
  if (wantsDetailedExitCode && changes.length) finish(2);
  finish(0);
}

function terraformShow(run: TerraformRun) {
  record(false, run.env);
  const planFile = positionalArguments(run.options)[0];
  if (!planFile || !existsSync(resolve(run.folder, planFile))) {
    printError("Error: no saved plan file given");
    finish(1);
  }
  const savedPlan = readFileSync(resolve(run.folder, planFile), "utf8");
  print(savedPlan.trim());
  finish(0);
}

function terraformApply(run: TerraformRun) {
  const isDestroy = run.command === "destroy";
  const changes = plan(run.env, run.home, isDestroy);
  printChanges(changes);
  const approved =
    hasFlag(run.options, "-auto-approve") || process.env.TALLOWMARK_CONFIRM === "yes";
  if (!approved) {
    record(false, run.env, { refused: "no approval" });
    print(`\nApply cancelled. Run with -auto-approve, or type yes when a person approves.`);
    finish(1);
  }
  applyPlan(run.env, changes, run.home);
  const changeSummaries = changes.map((change) => `${change.actions.join("+")} ${change.address}`);
  record(true, run.env, { changes: changeSummaries });
  const doneWord = isDestroy ? "Destroy" : "Apply";
  print(`\n${doneWord} complete! Resources: ${changes.length} changed.`);
  finish(0);
}

// Supports "state list" and "state rm <address>". Anything else returns to the caller.
function terraformState(run: TerraformRun) {
  const [subcommand, address] = run.options;
  if (subcommand === "list") {
    record(false, run.env);
    for (const resourceAddress of Object.keys(loadCloud(run.env, run.home))) {
      print(resourceAddress);
    }
    finish(0);
  }
  if (subcommand === "rm" && address) {
    const cloud = loadCloud(run.env, run.home);
    delete cloud[address];
    saveCloud(run.env, cloud, run.home);
    record(true, run.env);
    print(`Removed ${address}`);
    finish(0);
  }
}

function changeLabel(change: Change): { sentence: string; mark: string } {
  if (change.actions.includes("delete")) return { sentence: "will be destroyed", mark: "-" };
  if (change.actions.includes("create")) return { sentence: "will be created", mark: "+" };
  return { sentence: "will be updated in-place", mark: "~" };
}

function printChanges(changes: Change[]) {
  for (const change of changes) {
    const { sentence, mark } = changeLabel(change);
    print(`  # ${change.address} ${sentence}`);
    for (const difference of change.diff) print(`      ${mark} ${difference}`);
    if (!change.diff.length) print(`    ${mark} resource "${change.type}"`);
  }
  if (!changes.length) {
    print("No changes. Your infrastructure matches the configuration.");
    return;
  }
  const countOf = (action: string) =>
    changes.filter((change) => change.actions.includes(action)).length;
  const toAdd = countOf("create");
  const toChange = countOf("update");
  const toDestroy = countOf("delete");
  print(`\nPlan: ${toAdd} to add, ${toChange} to change, ${toDestroy} to destroy.`);
}

// The same shape as Terraform's own plan JSON. Object.fromEntries keeps Terraform's field names
// exactly as Terraform spells them.
function planJson(env: Env, changes: Change[]) {
  const resourceChanges = changes.map((change) => ({
    address: change.address,
    mode: "managed",
    type: change.type,
    name: change.address.split(".").pop(),
    change: { actions: change.actions, before: change.before, after: change.after },
  }));
  return Object.fromEntries([
    ["format_version", "1.2"],
    ["terraform_version", "1.17.2"],
    ["env", env],
    ["resource_changes", resourceChanges],
  ]);
}

// ---------- kubectl ----------

// The namespace each Helm release runs in.
const RELEASE_NAMESPACES: Record<string, string> = { "seat-api": "seat", "waiting-room": "queue" };

type SimulatedPod = { namespace: string; name: string; status: string; restarts: number };

function simulatedPods(env: Env): SimulatedPod[] {
  const cluster = loadCluster(env);
  return [...releasePods(cluster), ...scanPods(cluster)];
}

function releasePods(cluster: Cluster): SimulatedPod[] {
  const pods: SimulatedPod[] = [];
  for (const [releaseName, release] of Object.entries(cluster.releases)) {
    pods.push(...podsOfRelease(releaseName, release));
  }
  return pods;
}

// A release whose probe checks a different port than the container listens on keeps crashing.
function podsOfRelease(releaseName: string, release: Release): SimulatedPod[] {
  const values = release.values;
  const broken = Number(values.probe?.port) !== Number(values.containerPort);
  const replicaCount = Number(values.replicaCount ?? 1);
  const pods: SimulatedPod[] = [];
  for (let i = 0; i < replicaCount; i++) {
    pods.push({
      namespace: RELEASE_NAMESPACES[releaseName] ?? "default",
      name: `${releaseName}-${release.revision}${i}x7`,
      status: broken ? "CrashLoopBackOff" : "Running",
      restarts: broken ? 14 : 0,
    });
  }
  return pods;
}

function scanPods(cluster: Cluster): SimulatedPod[] {
  const pods: SimulatedPod[] = [];
  if (!cluster.namespaces.includes("scan")) return pods;
  for (const [autoscalerName, autoscaler] of Object.entries(cluster.hpa)) {
    for (let i = 0; i < autoscaler.minReplicas; i++) {
      pods.push({
        namespace: "scan",
        name: `${autoscalerName}-${i}q2`,
        status: "Running",
        restarts: 0,
      });
    }
  }
  return pods;
}

type KubectlRun = {
  verb: string;
  kind: string;
  name: string;
  env: Env;
  context: string;
  namespace: string | undefined;
  allNamespaces: boolean;
};

const KUBECTL_FLAGS_WITH_VALUE = ["--context", "-n", "--namespace", "-l", "-o", "--replicas"];
const KUBECTL_MUTATING_VERBS = new Set([
  "scale",
  "drain",
  "apply",
  "patch",
  "edit",
  "cordon",
  "rollout",
  "exec",
]);

function kubectl(args: string[]) {
  const context =
    flagValue(args, "--context") ?? process.env.KUBE_CONTEXT ?? "kind-tallowmark-prod";
  const env = environmentFor(context);
  if (!env) {
    record(false, null);
    printError(
      `error: context "${context}" does not exist. ` +
        "Use kind-tallowmark-dev or kind-tallowmark-prod.",
    );
    return finish(1);
  }
  const [verb, kind, name] = positionalArguments(args, KUBECTL_FLAGS_WITH_VALUE);
  const namespace = flagValue(args, "-n", "--namespace");
  const allNamespaces = hasFlag(args, "-A", "--all-namespaces");
  const run: KubectlRun = { verb, kind, name, env, context, namespace, allNamespaces };
  runKubectlVerb(run);
  record(false, env);
  printError(
    `kubectl ${verb ?? ""}: not part of the practice world. ` +
      "Supported: get, describe, logs, delete, scale, drain, apply, config.",
  );
  return finish(1);
}

// Runs the verb and exits. Returns only when the verb is not one the world supports.
function runKubectlVerb(run: KubectlRun) {
  if (run.verb === "config") {
    record(false, run.env);
    print(run.context);
    finish(0);
  }
  if (run.verb === "get" || run.verb === "describe" || run.verb === "logs") kubectlRead(run);
  if (run.verb === "delete") kubectlDelete(run);
  if (KUBECTL_MUTATING_VERBS.has(run.verb))
    kubectlMutated(run, `${run.verb} done on ${run.context}`);
  if (run.verb === "version") {
    record(false, run.env);
    print("Client Version: v1.37.2 (practice world)");
    finish(0);
  }
}

function kubectlMutated(run: KubectlRun, message: string): never {
  record(true, run.env, { context: run.context });
  print(message);
  return finish(0);
}

function kubectlRead(run: KubectlRun): never {
  record(false, run.env, { context: run.context });
  if (run.kind === "nodes") {
    print("NAME                         STATUS   ROLES           VERSION");
    print(`tallowmark-${run.env}-control-plane   Ready    control-plane   v1.37.2`);
    return finish(0);
  }
  if (run.kind === "ns" || run.kind === "namespaces") {
    print("NAME     STATUS");
    for (const namespace of loadCluster(run.env).namespaces) print(`${namespace.padEnd(8)} Active`);
    return finish(0);
  }
  if (run.verb === "logs") {
    print("listening on :8080");
    return finish(0);
  }
  printPods(run);
  return finish(0);
}

function printPods(run: KubectlRun) {
  const wantedNamespace = run.namespace ?? "default";
  const pods = simulatedPods(run.env).filter(
    (podRow) => run.allNamespaces || podRow.namespace === wantedNamespace,
  );
  const namespaceHeader = run.allNamespaces ? "NAMESPACE  " : "";
  print(`${namespaceHeader}NAME                   STATUS             RESTARTS`);
  for (const podRow of pods) {
    const namespaceColumn = run.allNamespaces ? podRow.namespace.padEnd(11) : "";
    print(
      `${namespaceColumn}${podRow.name.padEnd(23)}${podRow.status.padEnd(19)}${podRow.restarts}`,
    );
  }
  if (!pods.length) print(`No resources found in ${wantedNamespace} namespace.`);
}

// Deleting a namespace also removes the releases in it, and the scan autoscaler with "scan".
function kubectlDelete(run: KubectlRun): never {
  if (run.kind !== "ns" && run.kind !== "namespace") {
    return kubectlMutated(run, `${run.kind} "${run.name ?? "selected"}" deleted`);
  }
  const cluster = loadCluster(run.env);
  cluster.namespaces = cluster.namespaces.filter((namespace) => namespace !== run.name);
  for (const releaseName of Object.keys(cluster.releases)) {
    if (RELEASE_NAMESPACES[releaseName] === run.name) delete cluster.releases[releaseName];
  }
  if (run.name === "scan") cluster.hpa = {};
  saveCluster(run.env, cluster);
  return kubectlMutated(run, `namespace "${run.name}" deleted`);
}

// ---------- helm ----------

type ChartFile = { apiVersion?: unknown; name?: unknown; version?: unknown };

function readYaml<T>(path: string): T {
  return Bun.YAML.parse(readFileSync(path, "utf8")) as T;
}

function valueAtPath(values: unknown, path: string): unknown {
  const keys = path.split(".").filter(Boolean);
  let current = values;
  for (const key of keys) current = (current as Record<string, unknown> | undefined)?.[key];
  return current;
}

// Fills in the two template forms the practice charts use: {{ .Values.x }} and toYaml ... nindent.
export function renderChart(
  chartDir: string,
  values: unknown = readYaml(join(chartDir, "values.yaml")),
): string {
  const template = readFileSync(join(chartDir, "templates", "deployment.yaml"), "utf8");
  const toYamlPattern = /\{\{\s*toYaml \.Values\.([\w.]+)\s*\|\s*nindent \d+\s*\}\}/g;
  const valuePattern = /\{\{\s*\.Values\.([\w.]+)\s*\}\}/g;
  const withBlocks = template.replace(toYamlPattern, (_match, path: string) =>
    JSON.stringify(valueAtPath(values, path) ?? {}),
  );
  return withBlocks.replace(valuePattern, (_match, path: string) =>
    String(valueAtPath(values, path)),
  );
}

type HelmRun = {
  verb: string;
  first: string;
  second: string;
  env: Env;
  context: string;
};

const HELM_FLAGS_WITH_VALUE = ["--kube-context", "-n", "--namespace", "-f", "--values", "--set"];

function helm(args: string[]) {
  const context =
    flagValue(args, "--kube-context") ?? process.env.KUBE_CONTEXT ?? "kind-tallowmark-prod";
  const env = environmentFor(context);
  if (!env) {
    record(false, null);
    printError(`Error: context "${context}" does not exist`);
    return finish(1);
  }
  const [verb, first, second] = positionalArguments(args, HELM_FLAGS_WITH_VALUE);
  runHelmVerb({ verb, first, second, env, context });
  record(false, env);
  printError(
    `helm ${verb ?? ""}: not part of the practice world. ` +
      "Supported: list, lint, template, upgrade, uninstall, rollback.",
  );
  return finish(1);
}

// Runs the verb and exits. Returns only when the verb is not one the world supports.
function runHelmVerb(run: HelmRun) {
  const handler = HELM_VERBS.get(run.verb);
  if (handler) handler(run);
}

const HELM_VERBS = new Map<string, (run: HelmRun) => void>([
  ["version", helmVersion],
  ["list", helmList],
  ["ls", helmList],
  ["lint", helmLint],
  ["template", helmTemplate],
  ["upgrade", helmUpgrade],
  ["install", helmUpgrade],
  ["uninstall", helmUninstall],
  ["delete", helmUninstall],
  ["rollback", helmUninstall],
]);

function helmVersion(run: HelmRun) {
  record(false, run.env);
  print("v4.3.1 (practice world)");
  finish(0);
}

function helmList(run: HelmRun) {
  record(false, run.env, { context: run.context });
  print("NAME          NAMESPACE  REVISION  CHART");
  for (const [releaseName, release] of Object.entries(loadCluster(run.env).releases)) {
    const namespace = RELEASE_NAMESPACES[releaseName] ?? "default";
    const revision = String(release.revision);
    print(`${releaseName.padEnd(14)}${namespace.padEnd(11)}${revision.padEnd(10)}${release.chart}`);
  }
  finish(0);
}

const LINT_FAILED = "Error: 1 chart(s) linted, 1 chart(s) failed";

function helmLint(run: HelmRun) {
  record(false, run.env);
  const chartFolder = resolve(run.first ?? ".");
  const chartPath = join(chartFolder, "Chart.yaml");
  const chart = existsSync(chartPath) ? readYaml<ChartFile>(chartPath) : null;
  const chartIsValid = chart?.apiVersion === "v2" && chart.name && chart.version;
  if (!chartIsValid) {
    print(`[ERROR] Chart.yaml: missing or not apiVersion v2\n${LINT_FAILED}`);
    finish(1);
  }
  try {
    readYaml(join(chartFolder, "values.yaml"));
  } catch (error) {
    print(`[ERROR] values.yaml: ${(error as Error).message}\n${LINT_FAILED}`);
    finish(1);
  }
  print(`==> Linting ${run.first ?? "."}\n[INFO] Chart.yaml: icon is recommended\n`);
  print("1 chart(s) linted, 0 chart(s) failed");
  finish(0);
}

function helmTemplate(run: HelmRun) {
  record(false, run.env);
  const chartFolder = resolve(run.second ?? run.first ?? ".");
  print(renderChart(chartFolder));
  finish(0);
}

function helmUpgrade(run: HelmRun) {
  const releaseName = run.first;
  const chartFolder = resolve(run.second ?? ".");
  if (!existsSync(join(chartFolder, "Chart.yaml"))) {
    record(false, run.env);
    printError(`Error: no chart at ${run.second}`);
    finish(1);
  }
  const chart = readYaml<ChartFile>(join(chartFolder, "Chart.yaml"));
  const cluster = loadCluster(run.env);
  const previous = cluster.releases[releaseName];
  const revision = (previous?.revision ?? 0) + 1;
  cluster.releases[releaseName] = {
    chart: `${chart.name}-${chart.version}`,
    revision,
    values: readYaml(join(chartFolder, "values.yaml")),
  };
  saveCluster(run.env, cluster);
  record(true, run.env, { context: run.context });
  print(`Release "${releaseName}" has been upgraded. Happy Helming!\nREVISION: ${revision}`);
  finish(0);
}

// Handles uninstall, delete and rollback. A rollback keeps the release as it is.
function helmUninstall(run: HelmRun) {
  const cluster = loadCluster(run.env);
  const isRollback = run.verb === "rollback";
  if (!isRollback) delete cluster.releases[run.first];
  saveCluster(run.env, cluster);
  record(true, run.env, { context: run.context });
  if (isRollback) print("Rollback was a success.");
  else print(`release "${run.first}" uninstalled`);
  finish(0);
}

// ---------- aws ----------

type AwsRun = {
  args: string[];
  operation: string;
  env: Env;
  profile: string;
  bucket: string | undefined;
  cloud: Cloud;
};

const AWS_FLAGS_WITH_VALUE = [
  "--profile",
  "--bucket",
  "--versioning-configuration",
  "--region",
  "--output",
];

const PUBLIC_ACCESS_FIELDS = [
  "block_public_acls",
  "block_public_policy",
  "ignore_public_acls",
  "restrict_public_buckets",
];

function aws(args: string[]) {
  const profile = flagValue(args, "--profile") ?? process.env.AWS_PROFILE ?? "tallowmark-prod";
  const env = environmentFor(profile);
  if (!env) {
    record(false, null);
    printError(`The config profile (${profile}) could not be found`);
    return finish(255);
  }
  const [service, operation, target] = positionalArguments(args, AWS_FLAGS_WITH_VALUE);
  const bucketFromTarget = target?.replace(/^s3:\/\//, "").split("/")[0];
  const bucket = flagValue(args, "--bucket") ?? bucketFromTarget;
  const run: AwsRun = { args, operation, env, profile, bucket, cloud: loadCloud(env) };
  const handler = AWS_OPERATIONS.get(`${service} ${operation}`);
  if (handler) handler(run);
  record(false, env);
  printError(
    `aws ${service ?? ""} ${operation ?? ""}: not part of the practice world. ` +
      "Supported: sts get-caller-identity, s3 ls, s3 rb, s3api get-bucket-versioning, " +
      "s3api get-public-access-block.",
  );
  return finish(1);
}

function findBucketResource(run: AwsRun, type: string): Resource | undefined {
  const resources = Object.values(run.cloud);
  return resources.find(
    (resource) => resource.type === type && resource.attrs.bucket === run.bucket,
  );
}

function awsMutated(run: AwsRun, message: string): never {
  saveCloud(run.env, run.cloud);
  record(true, run.env, { profile: run.profile });
  print(message);
  return finish(0);
}

function awsCallerIdentity(run: AwsRun) {
  record(false, run.env);
  const account = run.env === "prod" ? "000000000002" : "000000000001";
  const arn = `arn:aws:iam::practice:user/${run.profile}`;
  // AWS spells its JSON field names with a capital first letter; Object.fromEntries keeps that.
  const identity = Object.fromEntries([
    ["Account", account],
    ["Arn", arn],
  ]);
  print(prettyJson(identity));
  finish(0);
}

function awsListBuckets(run: AwsRun) {
  record(false, run.env);
  const buckets = Object.values(run.cloud).filter((resource) => resource.type === "aws_s3_bucket");
  for (const bucket of buckets) print(`practice ${bucket.attrs.bucket}`);
  finish(0);
}

function awsGetVersioning(run: AwsRun) {
  record(false, run.env);
  const versioning = findBucketResource(run, "aws_s3_bucket_versioning");
  const configurations = versioning?.attrs.versioning_configuration as
    | { status?: unknown }[]
    | undefined;
  const status = configurations?.[0]?.status ?? "Suspended";
  print(prettyJson(Object.fromEntries([["Status", status]])));
  finish(0);
}

function awsGetPublicAccessBlock(run: AwsRun) {
  record(false, run.env);
  const accessBlock = findBucketResource(run, "aws_s3_bucket_public_access_block");
  if (!accessBlock) {
    printError("An error occurred (NoSuchPublicAccessBlockConfiguration)");
    finish(254);
  }
  const settings = accessBlock.attrs;
  const configuration = Object.fromEntries([
    ["BlockPublicAcls", settings.block_public_acls],
    ["IgnorePublicAcls", settings.ignore_public_acls],
    ["BlockPublicPolicy", settings.block_public_policy],
    ["RestrictPublicBuckets", settings.restrict_public_buckets],
  ]);
  print(prettyJson(Object.fromEntries([["PublicAccessBlockConfiguration", configuration]])));
  finish(0);
}

function awsPutVersioning(run: AwsRun) {
  const versioning = findBucketResource(run, "aws_s3_bucket_versioning");
  const configurationText = flagValue(run.args, "--versioning-configuration") ?? "";
  const status = /Status=(\w+)/.exec(configurationText)?.[1] ?? "Enabled";
  if (versioning) versioning.attrs.versioning_configuration = [{ status }];
  awsMutated(run, "");
}

function awsDeletePublicAccessBlock(run: AwsRun) {
  const accessBlock = findBucketResource(run, "aws_s3_bucket_public_access_block");
  if (accessBlock) {
    for (const field of PUBLIC_ACCESS_FIELDS) accessBlock.attrs[field] = false;
  }
  awsMutated(run, "");
}

function awsRemoveBucket(run: AwsRun) {
  for (const [address, resource] of Object.entries(run.cloud)) {
    if (resource.attrs.bucket === run.bucket) delete run.cloud[address];
  }
  awsMutated(run, `remove_bucket: ${run.bucket}`);
}

function awsCopyOrRemoveObjects(run: AwsRun) {
  awsMutated(run, `${run.operation}: done`);
}

// Keyed by "<service> <operation>", as typed after "aws".
const AWS_OPERATIONS = new Map<string, (run: AwsRun) => void>([
  ["sts get-caller-identity", awsCallerIdentity],
  ["s3 ls", awsListBuckets],
  ["s3api get-bucket-versioning", awsGetVersioning],
  ["s3api get-public-access-block", awsGetPublicAccessBlock],
  ["s3api put-bucket-versioning", awsPutVersioning],
  ["s3api delete-public-access-block", awsDeletePublicAccessBlock],
  ["s3 rb", awsRemoveBucket],
  ["s3 rm", awsCopyOrRemoveObjects],
  ["s3 cp", awsCopyOrRemoveObjects],
  ["s3 sync", awsCopyOrRemoveObjects],
]);

const TOOLS = new Map<string, (args: string[]) => void>([
  ["terraform", terraform],
  ["tofu", terraform],
  ["kubectl", kubectl],
  ["helm", helm],
  ["aws", aws],
]);

if (import.meta.main) {
  const runTool = TOOLS.get(tool);
  if (runTool) {
    runTool(toolArguments);
  } else {
    printError(`unknown tool ${tool}`);
    finish(2);
  }
}
