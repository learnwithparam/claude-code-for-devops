import type { Rule } from "../scripts/verify";
import { read, readSettings, section, suite } from "./lib";

const MODES = ["default", "acceptEdits", "plan", "auto", "dontAsk"];
const note = (folder: string) => read(folder, "notes", "permission-mode.md");

// The table row that starts with this mode, such as | `plan` | ... |
function rowFor(folder: string, mode: string): string | undefined {
  const rowStart = new RegExp(`^\\|\\s*\`?${mode}\`?\\s*\\|`);
  return note(folder)
    .split("\n")
    .find((line) => rowStart.test(line));
}

// Every cell after the mode name holds more than a few characters.
function isFilled(row: string | undefined): boolean {
  if (!row) return false;
  const cellsAfterMode = row.split("|").slice(2, -1);
  return cellsAfterMode.every((cell) => cell.trim().length > 3);
}

const defaultMode = (folder: string) => readSettings(folder)?.permissions?.defaultMode;

export default [
  {
    says: "notes/permission-mode.md has a filled row for each of the five modes",
    test: (folder) => MODES.every((mode) => isFilled(rowFor(folder, mode))),
    tryNext: "fill both cells for default, acceptEdits, plan, auto and dontAsk",
  },
  {
    says: "permissions.defaultMode is set",
    test: (folder) => typeof defaultMode(folder) === "string",
    tryNext: 'add "defaultMode" under permissions in .claude/settings.json',
  },
  {
    says: "the repo does not start in auto or bypassPermissions mode",
    test: (folder) => {
      const mode = defaultMode(folder);
      return !!mode && !["auto", "bypassPermissions"].includes(mode);
    },
    tryNext:
      "pick default or plan; auto is a classifier, not a rule, and Claude Code ignores it in " +
      "project settings",
  },
  {
    says: "the note's This repo section names the same mode as the settings",
    test: (folder) => {
      const sameMode = new RegExp(`Mode:\\s*\`?${defaultMode(folder)}\`?\\s*$`, "m");
      return sameMode.test(section(note(folder), "This repo"));
    },
    tryNext: "write Mode: followed by the value you set in defaultMode",
  },
  {
    says: "bypass mode is switched off",
    test: (folder) => readSettings(folder)?.permissions?.disableBypassPermissionsMode === "disable",
    tryNext: 'add "disableBypassPermissionsMode": "disable" under permissions',
  },
  {
    says: "the guard and the sandbox are still in place",
    test: async (folder) => {
      const { score } = await suite(folder, ["dangerous", "bypass", "safe"]);
      const dangerousBlocked = score.dangerous[0] + score.bypass[0];
      const safeAllowed = score.safe[0];
      const sandboxOn = readSettings(folder)?.sandbox?.enabled === true;
      return dangerousBlocked === 30 && safeAllowed === 15 && sandboxOn;
    },
    tryNext: "keep the hook, its wiring and the sandbox block from the earlier steps",
  },
] satisfies Rule[];
