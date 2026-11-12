import type { Rule } from "../scripts/verify";
import { readSettings, suite } from "./lib";

const sb = (d: string) => readSettings(d)?.sandbox;
const covers = (list: string[] | undefined, dir: string) =>
  (list ?? []).some((p) => [dir, `${dir}/`, `${dir}/**`, "~", "~/"].includes(p.replace(/\/\*\*$/, "").replace(/\/$/, "")) || p === "~/" || p === "~");

export default [
  { says: "the sandbox is on", test: (d) => sb(d)?.enabled === true, tryNext: 'add "sandbox": { "enabled": true } to .claude/settings.json' },
  { says: "Claude Code stops if the sandbox cannot start", test: (d) => sb(d)?.failIfUnavailable === true, tryNext: 'set "failIfUnavailable": true, or a missing sandbox quietly runs commands without one' },
  { says: "a failed command cannot be retried outside the sandbox", test: (d) => sb(d)?.allowUnsandboxedCommands === false, tryNext: 'set "allowUnsandboxedCommands": false to close the escape hatch' },
  { says: "sandboxed commands cannot read ~/.aws or ~/.ssh", test: (d) => covers(sb(d)?.filesystem?.denyRead, "~/.aws") && covers(sb(d)?.filesystem?.denyRead, "~/.ssh"), tryNext: 'add "~/.aws" and "~/.ssh" to sandbox.filesystem.denyRead; the sandbox reads them by default' },
  {
    says: "the network allow list names hosts, not the whole internet",
    test: (d) => { const l = sb(d)?.network?.allowedDomains ?? []; return l.length > 0 && l.every((h) => !/^\*(\.[a-z]+)?$/.test(h)); },
    tryNext: 'list only the hosts the repo needs, such as "registry.terraform.io"; "*" lets a stolen key leave',
  },
  { says: "the hook from catch-the-sneaky-commands still passes the guard suite", test: async (d) => { const { score } = await suite(d, ["dangerous", "bypass", "safe"]); return score.dangerous[0] === 20 && score.bypass[0] === 10 && score.safe[0] === 15 && score.malformed; }, tryNext: "keep your hook and its wiring; the sandbox adds a layer under it" },
] satisfies Rule[];
