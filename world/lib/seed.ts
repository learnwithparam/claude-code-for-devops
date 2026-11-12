// Builds one copy of the world from world/seed: the infra repo, the cloud and the clusters, with every fault planted.
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENVS, WORLD, desired, plan, applyPlan, saveCluster, loadCloud, saveCloud, log, type Cluster, type Env } from "../sim/state";

export const SEED = join(WORLD, "seed", "tallowmark-infra");

const yaml = (p: string) => Bun.YAML.parse(readFileSync(p, "utf8")) as any;

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
    const cl: Cluster = { namespaces: ["seat", "queue", "scan"], releases: {}, hpa: {} };
    for (const name of ["seat-api", "waiting-room"]) {
      const dir = join(repo, "charts", name);
      const c = yaml(join(dir, "Chart.yaml"));
      cl.releases[name] = { chart: `${c.name}-${c.version}`, revision: 1, values: yaml(join(dir, "values.yaml")) };
    }
    const hpa = yaml(join(repo, "k8s", "scan-telemetry-hpa.yaml"));
    cl.hpa[hpa.metadata.name] = { minReplicas: hpa.spec.minReplicas };
    saveCluster(env, cl, home);
  }
  writeFileSync(join(home, ".state", "seeded-from"), overlay ? "finished" : "seed");

  // The drift: someone on call changed prod by hand with the AWS CLI, not through Terraform.
  if (!overlay) plantDrift(home, "prod");
}

function plantDrift(home: string, env: Env) {
  const cloud = loadCloud(env, home);
  const bucket = `tallowmark-${env}-buyer-records`;
  for (const r of Object.values(cloud)) {
    if (r.attrs.bucket !== bucket) continue;
    if (r.type === "aws_s3_bucket_versioning") r.attrs.versioning_configuration = [{ status: "Suspended" }];
    if (r.type === "aws_s3_bucket_public_access_block")
      for (const k of ["block_public_acls", "block_public_policy", "ignore_public_acls", "restrict_public_buckets"]) r.attrs[k] = false;
  }
  saveCloud(env, cloud, home);
  const by = { actor: "ops-oncall", tool: "aws", env, mutating: true, cwd: "." };
  log({ ...by, args: ["s3api", "put-bucket-versioning", "--bucket", bucket, "--versioning-configuration", "Status=Suspended"] }, home);
  log({ ...by, args: ["s3api", "delete-public-access-block", "--bucket", bucket] }, home);
}

export const isSeeded = (home: string) => existsSync(join(home, ".state", "seeded-from"));
export { desired };
