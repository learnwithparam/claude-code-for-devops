// Reads the dev container Claude Code wrote: devcontainer.json, the Dockerfile, the firewall
// script and the managed settings. It builds no image and starts no container.

import { CLAUDE_CODE } from "../config/claude";
import type { Rule } from "../scripts/verify";
import { explain, read } from "./lib";

const STEP = "seal-the-devcontainer";
const ALLOWED_HOSTS = ["api.anthropic.com", "registry.npmjs.org", "registry.tallowmark.test"];
const MANAGED_PATH = "/etc/claude-code/managed-settings.json";
// A word that looks like a host name, such as api.anthropic.com. File names such as
// init-firewall.sh do not end in one of these.
const HOST_NAME = /\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|test|ai|app|cloud|co)\b/g;

type DevContainer = {
  build?: { dockerfile?: string };
  runArgs?: string[];
  postStartCommand?: string;
  containerEnv?: Record<string, string>;
};
type ManagedSettings = {
  allowManagedHooksOnly?: boolean;
  permissions?: { disableBypassPermissionsMode?: string };
  // biome-ignore lint/style/useNamingConvention: Claude Code names this hook event.
  hooks?: { PreToolUse?: { hooks?: { command?: string }[] }[] };
};

const devcontainerFile = (folder: string, name: string) => read(folder, ".devcontainer", name);

// devcontainer.json may hold comments. Lines that start with // are dropped before parsing.
function devContainer(folder: string): DevContainer | null {
  const lines = devcontainerFile(folder, "devcontainer.json").split("\n");
  const codeLines = lines.filter((line) => !line.trim().startsWith("//"));
  const withoutComments = codeLines.join("\n");
  try {
    return JSON.parse(withoutComments);
  } catch {
    return null;
  }
}

function managedSettings(folder: string): ManagedSettings | null {
  try {
    return JSON.parse(devcontainerFile(folder, "managed-settings.json"));
  } catch {
    return null;
  }
}

const dockerfile = (folder: string) => devcontainerFile(folder, "Dockerfile");
const firewall = (folder: string) => devcontainerFile(folder, "init-firewall.sh");

// The Claude Code version the Dockerfile installs, read through an ARG when it uses one.
function claudeCodeVersion(folder: string): string {
  const text = dockerfile(folder);
  const installed = text.match(/@anthropic-ai\/claude-code@(\S+)/)?.[1] ?? "";
  const argument = installed.match(/^\$\{?(\w+)\}?$/)?.[1];
  if (!argument) return installed;
  const argumentLine = new RegExp(`ARG\\s+${argument}=(\\S+)`);
  return text.match(argumentLine)?.[1] ?? "";
}

function isAtLeast(version: string, oldest: string): boolean {
  const parts = version.split(".").map(Number);
  const oldestParts = oldest.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts[i] !== oldestParts[i]) return parts[i] > oldestParts[i];
  }
  return true;
}

function hostsInFirewall(folder: string): string[] {
  const codeLines = firewall(folder)
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    // The last lines curl a host that must not answer, to prove the firewall works.
    .filter((line) => !/\bcurl\b/.test(line));
  const hosts = codeLines.join("\n").match(HOST_NAME) ?? [];
  return [...new Set(hosts)].sort();
}

function hasGuardHook(folder: string): boolean {
  const groups = managedSettings(folder)?.hooks?.PreToolUse ?? [];
  const commands = groups.flatMap((group) => group.hooks ?? []).map((hook) => hook.command ?? "");
  const hookFile = commands.join(" ").match(/\/etc\/claude-code\/\S+\.ts/)?.[0];
  return Boolean(hookFile) && dockerfile(folder).includes(String(hookFile));
}

export default [
  {
    says: ".devcontainer/devcontainer.json parses and builds from the Dockerfile",
    test: (folder) => {
      const container = devContainer(folder);
      return Boolean(container?.build?.dockerfile) && dockerfile(folder) !== "";
    },
    tryNext: "ask Claude Code for devcontainer.json with build.dockerfile set to Dockerfile",
  },
  {
    says: "the firewall script runs at start, with the NET_ADMIN capability",
    test: (folder) => {
      const container = devContainer(folder);
      const startsFirewall = /init-firewall\.sh/.test(container?.postStartCommand ?? "");
      const canSetRules = (container?.runArgs ?? []).includes("--cap-add=NET_ADMIN");
      return startsFirewall && canSetRules && firewall(folder) !== "";
    },
    tryNext:
      'set postStartCommand to run init-firewall.sh and add "--cap-add=NET_ADMIN" to runArgs',
  },
  {
    says: `Claude Code is pinned to an exact version, ${CLAUDE_CODE.oldest} or newer`,
    test: (folder) => {
      const version = claudeCodeVersion(folder);
      return /^\d+\.\d+\.\d+$/.test(version) && isAtLeast(version, CLAUDE_CODE.oldest);
    },
    tryNext: `install @anthropic-ai/claude-code@${CLAUDE_CODE.newest}, never latest`,
  },
  {
    says: "Claude Code cannot update itself inside the box (DISABLE_AUTOUPDATER=1)",
    test: (folder) => {
      const inImage = /ENV\s+DISABLE_AUTOUPDATER[= ]1/.test(dockerfile(folder));
      const inContainer = devContainer(folder)?.containerEnv?.DISABLE_AUTOUPDATER === "1";
      return inImage || inContainer;
    },
    tryNext: "add ENV DISABLE_AUTOUPDATER=1 to the Dockerfile",
  },
  {
    says: "the firewall drops everything it does not allow",
    test: (folder) => {
      const script = firewall(folder);
      return (
        /--policy OUTPUT DROP|-P OUTPUT DROP/.test(script) && !/OUTPUT ACCEPT\s*$/m.test(script)
      );
    },
    tryNext: "end the firewall with iptables --policy OUTPUT DROP",
  },
  {
    says: "the allow list is only the Claude API, the npm registry and the world registry",
    test: (folder) => {
      const hosts = hostsInFirewall(folder);
      explain(STEP, [`hosts in init-firewall.sh: ${hosts.join(", ") || "none"}`]);
      return hosts.join() === [...ALLOWED_HOSTS].sort().join();
    },
    tryNext: `allow exactly ${ALLOWED_HOSTS.join(", ")}; every extra host is a way out`,
  },
  {
    says: `the Dockerfile copies the managed settings to ${MANAGED_PATH}`,
    test: (folder) => new RegExp(`COPY\\s+\\S+\\s+${MANAGED_PATH}`).test(dockerfile(folder)),
    tryNext: `add COPY .devcontainer/managed-settings.json ${MANAGED_PATH}`,
  },
  {
    says: "managed settings allow managed hooks only and switch bypass mode off",
    test: (folder) => {
      const settings = managedSettings(folder);
      const bypassOff = settings?.permissions?.disableBypassPermissionsMode === "disable";
      return settings?.allowManagedHooksOnly === true && bypassOff;
    },
    tryNext:
      'set "allowManagedHooksOnly": true and ' +
      'permissions.disableBypassPermissionsMode "disable" in managed-settings.json',
  },
  {
    says: "the guard hook moves into managed settings, and the image holds its file",
    test: (folder) => hasGuardHook(folder),
    tryNext:
      "with managed hooks only, the repo's hook stops running; " +
      "copy guard-infra.ts into /etc/claude-code/hooks and wire it in managed settings",
  },
] satisfies Rule[];
