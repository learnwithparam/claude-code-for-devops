// The world's system of record: what the cloud and the clusters really hold, per environment.
// Lives in <instance>/.state as JSON. Every command against it is logged to <instance>/logs/commands.jsonl.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseHcl, toJson, type Body } from "./hcl";

export const WORLD = resolve(import.meta.dir, "..");
export const ENVS = ["dev", "prod"] as const;
export type Env = (typeof ENVS)[number];

// An instance is one copy of the world: the learner's (world/live) or the finished system's (world/.finished).
export const instance = () => resolve(process.env.TALLOWMARK_HOME ?? join(WORLD, "live"));
export const repoDir = (home = instance()) => join(home, "tallowmark-infra");
const stateFile = (kind: "cloud" | "cluster", env: Env, home = instance()) => join(home, ".state", `${kind}-${env}.json`);

export type Resource = { address: string; type: string; attrs: Record<string, unknown> };
export type Cloud = Record<string, Resource>;
export type Release = { chart: string; revision: number; values: Record<string, any> };
export type Cluster = { namespaces: string[]; releases: Record<string, Release>; hpa: Record<string, { minReplicas: number }> };

const readJson = <T>(p: string, fallback: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const writeJson = (p: string, v: unknown) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };

export const loadCloud = (env: Env, home = instance()) => readJson<Cloud>(stateFile("cloud", env, home), {});
export const saveCloud = (env: Env, c: Cloud, home = instance()) => writeJson(stateFile("cloud", env, home), c);
export const loadCluster = (env: Env, home = instance()) =>
  readJson<Cluster>(stateFile("cluster", env, home), { namespaces: [], releases: {}, hpa: {} });
export const saveCluster = (env: Env, c: Cluster, home = instance()) => writeJson(stateFile("cluster", env, home), c);

// Every command is one line in the log. A sequence number, never a clock time, so runs compare cleanly.
export function log(entry: Record<string, unknown>, home = instance()) {
  const p = join(home, "logs", "commands.jsonl");
  mkdirSync(dirname(p), { recursive: true });
  const seq = existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).length + 1 : 1;
  appendFileSync(p, JSON.stringify({ seq, actor: process.env.TALLOWMARK_ACTOR ?? "agent-or-you", ...entry }) + "\n");
}
export const readLog = (name = "commands.jsonl", home = instance()) => {
  const p = join(home, "logs", name);
  return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
};

// Read the Terraform code for one environment, with its local modules, as a flat list of resources.
export function desired(env: Env, repo = repoDir()): Cloud {
  const out: Cloud = {};
  const dir = join(repo, "terraform", "envs", env);
  const add = (body: Body, prefix: string, baseDir: string) => {
    for (const b of body.blocks) {
      if (b.type === "resource") {
        const address = `${prefix}${b.labels[0]}.${b.labels[1]}`;
        out[address] = { address, type: b.labels[0], attrs: toJson(b.body) };
      }
      if (b.type === "module") {
        const src = String(b.body.attrs.source ?? "");
        const mdir = resolve(baseDir, src);
        add(readDir(mdir), `${prefix}module.${b.labels[0]}.`, mdir);
      }
    }
  };
  add(readDir(dir), "", dir);
  return out;
}
function readDir(dir: string): Body {
  if (!existsSync(dir)) throw new Error(`no Terraform code at ${dir}`);
  const merged: Body = { attrs: {}, blocks: [] };
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".tf")).sort()) {
    try {
      const b = parseHcl(readFileSync(join(dir, f), "utf8"));
      merged.blocks.push(...b.blocks);
    } catch (e) {
      throw new Error(`${join(dir, f)}: ${(e as Error).message}`);
    }
  }
  return merged;
}

export type Change = { address: string; type: string; actions: string[]; before: unknown; after: unknown; diff: string[] };

// Only attributes written in the code are compared, as Terraform does for the fields you set.
function differs(want: Record<string, unknown>, have: Record<string, unknown>, path = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(want)) {
    const h = have[k];
    if (v && typeof v === "object" && h && typeof h === "object") out.push(...differs(v as any, h as any, `${path}${k}.`));
    else if (JSON.stringify(v) !== JSON.stringify(h)) out.push(`${path}${k}: ${JSON.stringify(h)} -> ${JSON.stringify(v)}`);
  }
  return out;
}

export function plan(env: Env, home = instance(), destroyAll = false): Change[] {
  const want = destroyAll ? {} : desired(env, repoDir(home));
  const have = loadCloud(env, home);
  const changes: Change[] = [];
  for (const [a, r] of Object.entries(want)) {
    if (!have[a]) changes.push({ address: a, type: r.type, actions: ["create"], before: null, after: r.attrs, diff: [] });
    else {
      const d = differs(r.attrs, have[a].attrs);
      if (d.length) changes.push({ address: a, type: r.type, actions: ["update"], before: have[a].attrs, after: r.attrs, diff: d });
    }
  }
  for (const [a, r] of Object.entries(have))
    if (!want[a]) changes.push({ address: a, type: r.type, actions: ["delete"], before: r.attrs, after: null, diff: [] });
  return changes;
}

export function applyPlan(env: Env, changes: Change[], home = instance()) {
  const cloud = loadCloud(env, home);
  for (const c of changes) {
    if (c.actions.includes("delete")) delete cloud[c.address];
    else cloud[c.address] = { address: c.address, type: c.type, attrs: structuredClone(c.after) as Record<string, unknown> };
  }
  saveCloud(env, cloud, home);
}

export const bucketResources = (env: Env, bucket: string, home = instance()) =>
  Object.values(loadCloud(env, home)).filter((r) => r.attrs.bucket === bucket);
