import type { Rule } from "../scripts/verify";
import { read, readSettings, section, suite } from "./lib";

const MODES = ["default", "acceptEdits", "plan", "auto", "dontAsk"];
const note = (d: string) => read(d, "notes", "permission-mode.md");
const row = (d: string, m: string) =>
  note(d)
    .split("\n")
    .find((l) => new RegExp(`^\\|\\s*\`?${m}\`?\\s*\\|`).test(l));
const filled = (l?: string) =>
  !!l &&
  l
    .split("|")
    .slice(2, -1)
    .every((c) => c.trim().length > 3);
const mode = (d: string) => readSettings(d)?.permissions?.defaultMode;

export default [
  {
    says: "notes/permission-mode.md has a filled row for each of the five modes",
    test: (d) => MODES.every((m) => filled(row(d, m))),
    tryNext: "fill both cells for default, acceptEdits, plan, auto and dontAsk",
  },
  {
    says: "permissions.defaultMode is set",
    test: (d) => typeof mode(d) === "string",
    tryNext: 'add "defaultMode" under permissions in .claude/settings.json',
  },
  {
    says: "the repo does not start in auto or bypassPermissions mode",
    test: (d) => !!mode(d) && !["auto", "bypassPermissions"].includes(mode(d)!),
    tryNext:
      "pick default or plan; auto is a classifier, not a rule, and Claude Code ignores it in project settings",
  },
  {
    says: "the note's This repo section names the same mode as the settings",
    test: (d) =>
      new RegExp(`Mode:\\s*\`?${mode(d)}\`?\\s*$`, "m").test(section(note(d), "This repo")),
    tryNext: "write Mode: followed by the value you set in defaultMode",
  },
  {
    says: "bypass mode is switched off",
    test: (d) => readSettings(d)?.permissions?.disableBypassPermissionsMode === "disable",
    tryNext: 'add "disableBypassPermissionsMode": "disable" under permissions',
  },
  {
    says: "the guard and the sandbox are still in place",
    test: async (d) => {
      const { score } = await suite(d, ["dangerous", "bypass", "safe"]);
      return (
        score.dangerous[0] + score.bypass[0] === 30 &&
        score.safe[0] === 15 &&
        readSettings(d)?.sandbox?.enabled === true
      );
    },
    tryNext: "keep the hook, its wiring and the sandbox block from the earlier steps",
  },
] satisfies Rule[];
