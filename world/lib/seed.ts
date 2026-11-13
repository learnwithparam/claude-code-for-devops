// Builds one copy of the world from world/seed: the infra repo, the cloud and the clusters,
// with every fault planted.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  applyPlan,
  type Cluster,
  desired,
  ENVS,
  type Env,
  loadCloud,
  log,
  plan,
  saveCloud,
  saveCluster,
  WORLD,
} from "../sim/state";

export const SEED = join(WORLD, "seed", "tallowmark-infra");

// Only the fields of Chart.yaml and the autoscaler file that seeding reads.
type ChartFile = { name: string; version: string };
type AutoscalerFile = { metadata: { name: string }; spec: { minReplicas: number } };

const readYaml = <T>(path: string) => Bun.YAML.parse(readFileSync(path, "utf8")) as T;

// The clusters as the platform team left them: each chart deployed once, at revision 1.
function clusterFromRepo(repo: string): Cluster {
  const cluster: Cluster = { namespaces: ["seat", "queue", "scan"], releases: {}, hpa: {} };
  for (const name of ["seat-api", "waiting-room"]) {
    const dir = join(repo, "charts", name);
    const chart = readYaml<ChartFile>(join(dir, "Chart.yaml"));
    cluster.releases[name] = {
      chart: `${chart.name}-${chart.version}`,
      revision: 1,
      values: readYaml(join(dir, "values.yaml")),
    };
  }
  const autoscaler = readYaml<AutoscalerFile>(join(repo, "k8s", "scan-telemetry-hpa.yaml"));
  cluster.hpa[autoscaler.metadata.name] = { minReplicas: autoscaler.spec.minReplicas };
  return cluster;
}

// Commits as the platform team, with fixed settings, so the result never depends on the
// learner's own git config.
function git(repo: string, ...gitArgs: string[]) {
  const settings = [
    "-c",
    "user.name=Tallowmark platform team",
    "-c",
    "user.email=platform@tallowmark.test",
    "-c",
    "init.defaultBranch=main",
    "-c",
    "commit.gpgsign=false",
  ];
  return Bun.spawnSync(["git", ...settings, ...gitArgs], { cwd: repo });
}

// The infra repo is its own git repo, as it would be on a laptop, so Claude Code sees its
// history and not the course repo around it. .env stays out of git, like a real one.
function commitRepo(repo: string) {
  writeFileSync(join(repo, ".gitignore"), ".env\n");
  git(repo, "init", "-q");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "tallowmark-infra as the platform team left it");
}

export function seedInstance(home: string, overlay?: string) {
  rmSync(home, { recursive: true, force: true });
  const repo = join(home, "tallowmark-infra");
  mkdirSync(home, { recursive: true });
  cpSync(SEED, repo, { recursive: true });
  renameSync(join(repo, "env.seed"), join(repo, ".env"));
  if (overlay && existsSync(overlay)) cpSync(overlay, repo, { recursive: true, force: true });

  for (const env of ENVS) {
    // The code as it stood when the platform team last applied it, by a person.
    applyPlan(env, plan(env, home), home);
    saveCluster(env, clusterFromRepo(repo), home);
  }
  writeFileSync(join(home, ".state", "seeded-from"), overlay ? "finished" : "seed");
  commitRepo(repo);

  // The drift: someone on call changed prod by hand with the AWS CLI, not through Terraform.
  if (!overlay) plantDrift(home, "prod");
}

const PUBLIC_ACCESS_SETTINGS = [
  "block_public_acls",
  "block_public_policy",
  "ignore_public_acls",
  "restrict_public_buckets",
];

function plantDrift(home: string, env: Env) {
  const cloud = loadCloud(env, home);
  const bucket = `tallowmark-${env}-buyer-records`;
  for (const resource of Object.values(cloud)) {
    if (resource.attrs.bucket !== bucket) continue;
    if (resource.type === "aws_s3_bucket_versioning")
      resource.attrs.versioning_configuration = [{ status: "Suspended" }];
    if (resource.type === "aws_s3_bucket_public_access_block")
      for (const setting of PUBLIC_ACCESS_SETTINGS) resource.attrs[setting] = false;
  }
  saveCloud(env, cloud, home);
  const oncallCommand = { actor: "ops-oncall", tool: "aws", env, mutating: true, cwd: "." };
  const suspendVersioning = [
    "s3api",
    "put-bucket-versioning",
    "--bucket",
    bucket,
    "--versioning-configuration",
    "Status=Suspended",
  ];
  log({ ...oncallCommand, args: suspendVersioning }, home);
  const removeBlock = ["s3api", "delete-public-access-block", "--bucket", bucket];
  log({ ...oncallCommand, args: removeBlock }, home);
}

export const isSeeded = (home: string) => existsSync(join(home, ".state", "seeded-from"));
export { desired };
