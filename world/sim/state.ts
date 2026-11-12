// The world's system of record: what the cloud and the clusters really hold, per environment.
// Lives in <instance>/.state as JSON. Every command against it is logged to
// <instance>/logs/commands.jsonl.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type Body, parseHcl, toJson } from "./hcl";

export const WORLD = resolve(import.meta.dir, "..");
export const ENVS = ["dev", "prod"] as const;
export type Env = (typeof ENVS)[number];

// An instance is one copy of the world:
// the learner's (world/live) or the finished system's (world/.finished).
export const instance = () => resolve(process.env.TALLOWMARK_HOME ?? join(WORLD, "live"));
export const repoDir = (home = instance()) => join(home, "tallowmark-infra");

function stateFile(kind: "cloud" | "cluster", env: Env, home = instance()) {
  return join(home, ".state", `${kind}-${env}.json`);
}

export type Resource = { address: string; type: string; attrs: Record<string, unknown> };
export type Cloud = Record<string, Resource>;
// The values.yaml of a chart. The simulated pods only look at the ports and the replica count.
export type ChartValues = {
  containerPort?: unknown;
  replicaCount?: unknown;
  probe?: { port?: unknown; path?: unknown };
  [key: string]: unknown;
};
export type Release = { chart: string; revision: number; values: ChartValues };
export type Cluster = {
  namespaces: string[];
  releases: Record<string, Release>;
  hpa: Record<string, { minReplicas: number }>;
};

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) {
    return fallback;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path: string, content: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`);
}

export const loadCloud = (env: Env, home = instance()) =>
  readJson<Cloud>(stateFile("cloud", env, home), {});
export const saveCloud = (env: Env, cloud: Cloud, home = instance()) =>
  writeJson(stateFile("cloud", env, home), cloud);
export const loadCluster = (env: Env, home = instance()) =>
  readJson<Cluster>(stateFile("cluster", env, home), { namespaces: [], releases: {}, hpa: {} });
export const saveCluster = (env: Env, cluster: Cluster, home = instance()) =>
  writeJson(stateFile("cluster", env, home), cluster);

function logLines(path: string): string[] {
  const lines = readFileSync(path, "utf8").split("\n");
  return lines.filter(Boolean);
}

// Every command is one line in the log.
// A sequence number, never a clock time, so runs compare cleanly.
export function log(entry: Record<string, unknown>, home = instance()) {
  const path = join(home, "logs", "commands.jsonl");
  mkdirSync(dirname(path), { recursive: true });
  let sequence = 1;
  if (existsSync(path)) {
    sequence = logLines(path).length + 1;
  }
  const actor = process.env.TALLOWMARK_ACTOR ?? "agent-or-you";
  const line = JSON.stringify({ seq: sequence, actor, ...entry });
  appendFileSync(path, `${line}\n`);
}

export const readLog = (name = "commands.jsonl", home = instance()) => {
  const path = join(home, "logs", name);
  if (!existsSync(path)) {
    return [];
  }
  return logLines(path).map((line) => JSON.parse(line));
};

// Read the Terraform code for one environment, with its local modules, as a flat list of resources.
export function desired(env: Env, repo = repoDir()): Cloud {
  const resources: Cloud = {};
  const folder = join(repo, "terraform", "envs", env);
  addResources(resources, { body: readFolder(folder), prefix: "", folder });
  return resources;
}

// One folder of Terraform code, and the address prefix its resources get (module.<name>.).
type CodeFolder = { body: Body; prefix: string; folder: string };

function addResources(resources: Cloud, code: CodeFolder) {
  for (const block of code.body.blocks) {
    if (block.type === "resource") {
      const [type, name] = block.labels;
      const address = `${code.prefix}${type}.${name}`;
      resources[address] = { address, type, attrs: toJson(block.body) };
    }
    if (block.type === "module") {
      const source = String(block.body.attrs.source ?? "");
      const moduleFolder = resolve(code.folder, source);
      const prefix = `${code.prefix}module.${block.labels[0]}.`;
      addResources(resources, { body: readFolder(moduleFolder), prefix, folder: moduleFolder });
    }
  }
}

function readFolder(folder: string): Body {
  if (!existsSync(folder)) throw new Error(`no Terraform code at ${folder}`);
  const merged: Body = { attrs: {}, blocks: [] };
  const terraformFiles = readdirSync(folder).filter((file) => file.endsWith(".tf"));
  for (const file of terraformFiles.sort()) {
    const path = join(folder, file);
    try {
      const body = parseHcl(readFileSync(path, "utf8"));
      merged.blocks.push(...body.blocks);
    } catch (error) {
      throw new Error(`${path}: ${(error as Error).message}`);
    }
  }
  return merged;
}

export type Change = {
  address: string;
  type: string;
  actions: string[];
  before: unknown;
  after: unknown;
  diff: string[];
};

type Attributes = Record<string, unknown>;

function isObject(value: unknown): value is Attributes {
  return Boolean(value) && typeof value === "object";
}

// Only attributes written in the code are compared, as Terraform does for the fields you set.
function differences(wanted: Attributes, current: Attributes, path = ""): string[] {
  const found: string[] = [];
  for (const [key, wantedValue] of Object.entries(wanted)) {
    const currentValue = current[key];
    if (isObject(wantedValue) && isObject(currentValue)) {
      found.push(...differences(wantedValue, currentValue, `${path}${key}.`));
      continue;
    }
    const before = JSON.stringify(currentValue);
    const after = JSON.stringify(wantedValue);
    if (after !== before) found.push(`${path}${key}: ${before} -> ${after}`);
  }
  return found;
}

function changeFor(wanted: Resource, current: Resource | undefined): Change | undefined {
  const { address, type } = wanted;
  if (!current) {
    return { address, type, actions: ["create"], before: null, after: wanted.attrs, diff: [] };
  }
  const diff = differences(wanted.attrs, current.attrs);
  if (!diff.length) return undefined;
  return { address, type, actions: ["update"], before: current.attrs, after: wanted.attrs, diff };
}

export function plan(env: Env, home = instance(), destroyAll = false): Change[] {
  const wanted: Cloud = destroyAll ? {} : desired(env, repoDir(home));
  const current = loadCloud(env, home);
  const changes: Change[] = [];
  for (const [address, resource] of Object.entries(wanted)) {
    const change = changeFor(resource, current[address]);
    if (change) changes.push(change);
  }
  for (const [address, resource] of Object.entries(current)) {
    if (wanted[address]) continue;
    const { type, attrs } = resource;
    changes.push({ address, type, actions: ["delete"], before: attrs, after: null, diff: [] });
  }
  return changes;
}

export function applyPlan(env: Env, changes: Change[], home = instance()) {
  const cloud = loadCloud(env, home);
  for (const change of changes) {
    if (change.actions.includes("delete")) {
      delete cloud[change.address];
      continue;
    }
    cloud[change.address] = {
      address: change.address,
      type: change.type,
      attrs: structuredClone(change.after) as Attributes,
    };
  }
  saveCloud(env, cloud, home);
}

export const bucketResources = (env: Env, bucket: string, home = instance()) => {
  const resources = Object.values(loadCloud(env, home));
  return resources.filter((resource) => resource.attrs.bucket === bucket);
};
