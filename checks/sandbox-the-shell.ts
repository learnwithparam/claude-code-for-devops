import type { Rule } from "../scripts/verify";
import { readSettings, suite } from "./lib";

const sandbox = (folder: string) => readSettings(folder)?.sandbox;

// True when one entry in the list covers the folder, or covers the whole home folder (~).
function covers(list: string[] | undefined, folder: string): boolean {
  const sameFolder = [folder, `${folder}/`, `${folder}/**`, "~", "~/"];
  return (list ?? []).some((entry) => {
    const trimmed = entry.replace(/\/\*\*$/, "").replace(/\/$/, "");
    return sameFolder.includes(trimmed) || entry === "~/" || entry === "~";
  });
}

// Each allowed host is a real name, never "*" or a whole top-level domain such as "*.com".
function namesHosts(folder: string): boolean {
  const hosts = sandbox(folder)?.network?.allowedDomains ?? [];
  return hosts.length > 0 && hosts.every((host) => !/^\*(\.[a-z]+)?$/.test(host));
}

export default [
  {
    says: "the sandbox is on",
    test: (folder) => sandbox(folder)?.enabled === true,
    tryNext: 'add "sandbox": { "enabled": true } to .claude/settings.json',
  },
  {
    says: "Claude Code stops if the sandbox cannot start",
    test: (folder) => sandbox(folder)?.failIfUnavailable === true,
    tryNext:
      'set "failIfUnavailable": true, or a missing sandbox quietly runs commands without one',
  },
  {
    says: "a failed command cannot be retried outside the sandbox",
    test: (folder) => sandbox(folder)?.allowUnsandboxedCommands === false,
    tryNext: 'set "allowUnsandboxedCommands": false to close the escape hatch',
  },
  {
    says: "sandboxed commands cannot read ~/.aws or ~/.ssh",
    test: (folder) => {
      const denyRead = sandbox(folder)?.filesystem?.denyRead;
      return covers(denyRead, "~/.aws") && covers(denyRead, "~/.ssh");
    },
    tryNext:
      'add "~/.aws" and "~/.ssh" to sandbox.filesystem.denyRead; the sandbox reads them by default',
  },
  {
    says: "the network allow list names hosts, not the whole internet",
    test: (folder) => namesHosts(folder),
    tryNext:
      'list only the hosts the repo needs, such as "registry.terraform.io"; ' +
      '"*" lets a stolen key leave',
  },
  {
    says: "the hook from catch-the-sneaky-commands still passes the guard suite",
    test: async (folder) => {
      const { score } = await suite(folder, ["dangerous", "bypass", "safe"]);
      const allDangerousBlocked = score.dangerous[0] === 20;
      const allBypassBlocked = score.bypass[0] === 10;
      const allSafeAllowed = score.safe[0] === 15;
      return allDangerousBlocked && allBypassBlocked && allSafeAllowed && score.malformed;
    },
    tryNext: "keep your hook and its wiring; the sandbox adds a layer under it",
  },
] satisfies Rule[];
