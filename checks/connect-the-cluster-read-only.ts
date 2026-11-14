import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, normalize } from "node:path";
import type { Rule } from "../scripts/verify";
import {
  canI,
  READER_NAME,
  readerAccount,
  readerRoles,
  readManifests,
} from "./helpers/03-give-it-eyes/rbac";
import { explain, read, readSettings, suite } from "./lib";

const STEP = "connect-the-cluster-read-only";
const READER_KUBECONFIG = join("kubeconfig", "claude-reader.yaml");
const CONTEXTS = ["kind-tallowmark-dev", "kind-tallowmark-prod"];

// The verbs that change a cluster, tried on the resources a slip would hurt most.
const WRITE_VERBS = ["create", "update", "patch", "delete", "deletecollection", "escalate", "bind"];
const WRITE_TARGETS = ["pods", "deployments", "namespaces", "horizontalpodautoscalers", "secrets"];

// The kubernetes-mcp-server tools that change a cluster. The names come from its README.
const WRITE_TOOLS = [
  "pods_delete",
  "pods_exec",
  "pods_run",
  "resources_create_or_update",
  "resources_delete",
  "resources_scale",
  "helm_install",
  "helm_uninstall",
];
const READ_TOOLS = ["pods_list", "pods_log", "resources_get", "events_list"];

type Server = { command?: string; args?: string[]; env?: Record<string, string> };
type Kubeconfig = {
  users?: { name?: string; user?: Record<string, unknown> }[];
  contexts?: { name?: string; context?: { user?: string } }[];
};

function readYaml<T>(folder: string, path: string): T | null {
  try {
    return Bun.YAML.parse(read(folder, path)) as T;
  } catch {
    return null;
  }
}

function kubernetesServer(folder: string): Server | undefined {
  try {
    return JSON.parse(read(folder, ".mcp.json"))?.mcpServers?.kubernetes;
  } catch {
    return undefined;
  }
}

// The server's TOML settings, from the file after --config.
function serverSettings(folder: string): Record<string, unknown> {
  const args = kubernetesServer(folder)?.args ?? [];
  const configFile = args[args.indexOf("--config") + 1];
  if (!args.includes("--config") || !configFile) return {};
  const path = join(folder, configFile);
  if (!existsSync(path)) return {};
  return Bun.TOML.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

// The kubeconfig the server reads: the TOML kubeconfig key, or KUBECONFIG in .mcp.json.
function kubeconfigInUse(folder: string): string {
  const fromSettings = serverSettings(folder).kubeconfig;
  const fromEnvironment = kubernetesServer(folder)?.env?.KUBECONFIG;
  const path = String(fromSettings ?? fromEnvironment ?? "");
  return path.replace(/^~\//, `${homedir()}/`);
}

function readerReachesBothClusters(folder: string): boolean {
  const kubeconfig = readYaml<Kubeconfig>(folder, READER_KUBECONFIG);
  const reader = kubeconfig?.users?.find((user) => user.name === READER_NAME);
  const hasToken = typeof reader?.user?.token === "string";
  const holdsAdminKey = Boolean(reader?.user?.["client-key-data"]);
  const contextUser = (name: string) =>
    kubeconfig?.contexts?.find((context) => context.name === name)?.context?.user;
  const everyContextIsReader = CONTEXTS.every((name) => contextUser(name) === READER_NAME);
  return hasToken && !holdsAdminKey && everyContextIsReader;
}

// The writes the reader could make. Each one is printed under the FAIL.
function writesAllowed(folder: string): string[] {
  const manifests = readManifests(folder);
  const allowed: string[] = [];
  for (const verb of WRITE_VERBS) {
    for (const target of WRITE_TARGETS) {
      if (canI(manifests, verb, target)) allowed.push(`can-i ${verb} ${target}: yes`);
    }
  }
  explain(STEP, allowed);
  return allowed;
}

const hasReader = (folder: string) => Boolean(readerAccount(readManifests(folder)));

const escapeForRegex = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

// A deny rule with no parentheses is a tool name, where * matches any characters.
function denyRuleCovers(rule: string, tool: string): boolean {
  if (rule.includes("(")) return false;
  const pieces = rule.split("*").map(escapeForRegex);
  return new RegExp(`^${pieces.join(".*")}$`).test(tool);
}

function isDenied(folder: string, tool: string): boolean {
  const denyRules = readSettings(folder)?.permissions?.deny ?? [];
  return denyRules.some((rule) => denyRuleCovers(rule, `mcp__kubernetes__${tool}`));
}

export default [
  {
    says: "k8s/claude-reader.yaml makes the claude-reader ServiceAccount, bound to a ClusterRole",
    test: (folder) => {
      const manifests = readManifests(folder);
      return Boolean(readerAccount(manifests)) && readerRoles(manifests).length > 0;
    },
    tryNext:
      "ask for a ServiceAccount named claude-reader, a ClusterRole, " +
      "and a ClusterRoleBinding that joins them",
  },
  {
    says: "the reader can get, list and watch pods",
    test: (folder) => {
      const manifests = readManifests(folder);
      return ["get", "list", "watch"].every((verb) => canI(manifests, verb, "pods"));
    },
    tryNext: 'give the ClusterRole the verbs "get", "list" and "watch" on "pods"',
  },
  {
    says: "the reader cannot create, change or delete anything",
    test: (folder) => hasReader(folder) && writesAllowed(folder).length === 0,
    tryNext:
      'list only "get", "list" and "watch" as verbs; "*" also means delete, ' +
      "and read_only in the server settings does not change that",
  },
  {
    says: "the reader cannot read secrets",
    test: (folder) => {
      const manifests = readManifests(folder);
      const readsNoSecret = ["get", "list", "watch"].every(
        (verb) => !canI(manifests, verb, "secrets"),
      );
      return hasReader(folder) && readsNoSecret;
    },
    tryNext: 'name each resource the reader needs; "*" in resources also covers secrets',
  },
  {
    says: "kubeconfig/claude-reader.yaml reaches dev and prod as claude-reader, with a token",
    test: readerReachesBothClusters,
    tryNext:
      "give the kubeconfig the contexts kind-tallowmark-dev and kind-tallowmark-prod, " +
      "both with the user claude-reader and a token, and no client-key-data",
  },
  {
    says: ".mcp.json runs kubernetes-mcp-server at an exact version with read_only on",
    test: (folder) => {
      const args = kubernetesServer(folder)?.args ?? [];
      const pinned = args.some((arg) => /^kubernetes-mcp-server@\d+\.\d+\.\d+$/.test(arg));
      return pinned && serverSettings(folder).read_only === true;
    },
    tryNext:
      'run "npx -y kubernetes-mcp-server@0.1.2 --config mcp/kubernetes.toml" ' +
      "with read_only = true in that TOML file",
  },
  {
    says: "the MCP server uses the reader kubeconfig, not your own ~/.kube/config",
    test: (folder) => normalize(kubeconfigInUse(folder)) === READER_KUBECONFIG,
    tryNext: 'set kubeconfig = "kubeconfig/claude-reader.yaml" in the server TOML file',
  },
  {
    says: "settings deny every kubernetes write tool, and still allow the read tools",
    test: (folder) => {
      const missing = WRITE_TOOLS.filter((tool) => !isDenied(folder, tool));
      const blockedReads = READ_TOOLS.filter((tool) => isDenied(folder, tool));
      explain(STEP, [...missing.map((tool) => `not denied: mcp__kubernetes__${tool}`)]);
      return missing.length === 0 && blockedReads.length === 0;
    },
    tryNext:
      "the lines above name each write tool not denied yet; deny them one by one, " +
      "never the whole mcp__kubernetes server",
  },
  {
    says: "the guard from part one still blocks 30 of 30 and allows 15 of 15",
    test: async (folder) => {
      const { score } = await suite(folder, ["dangerous", "bypass", "safe"]);
      const blocked = score.dangerous[0] + score.bypass[0];
      return blocked === 30 && score.safe[0] === 15;
    },
    tryNext: "keep .claude/hooks/guard-infra.ts and its PreToolUse wiring as part one left them",
  },
] satisfies Rule[];
