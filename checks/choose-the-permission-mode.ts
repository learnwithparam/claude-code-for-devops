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

const ORIGINAL_REPLICAS = "service: seat-api\nreplicas: 3\n";
const undoLog = (folder: string) => read(folder, "notes", "undo-log.md");

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
      "pick default or plan; " +
      "auto is a classifier, not a rule, and Claude Code ignores it in project settings",
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
  {
    says: "the note's When it goes wrong section names diff review, Esc, /rewind and /clear",
    test: (folder) => {
      const undo = section(note(folder), "When it goes wrong");
      return (
        /diff/i.test(undo) &&
        /\bEsc\b/.test(undo) &&
        undo.includes("/rewind") &&
        undo.includes("/clear")
      );
    },
    tryNext: "add a When it goes wrong section: read the diff, press Esc, then /rewind and /clear",
  },
  {
    says: "notes/undo-log.md shows the bad edit as a diff, from replicas 3 to replicas 0",
    test: (folder) => {
      const edit = section(undoLog(folder), "The bad edit");
      return /^-replicas: 3\s*$/m.test(edit) && /^\+replicas: 0\s*$/m.test(edit);
    },
    tryNext: "paste the diff you saw before you pressed Esc, under a heading The bad edit",
  },
  {
    says: "notes/undo-log.md says you pressed Esc and used /rewind",
    test: (folder) => {
      const back = section(undoLog(folder), "How I got it back");
      return /\bEsc\b/.test(back) && back.includes("/rewind");
    },
    tryNext: "under How I got it back, say you pressed Esc, then ran /rewind",
  },
  {
    says: "scratch/replicas.yaml is back to replicas 3 after the rewind",
    test: (folder) => read(folder, "scratch", "replicas.yaml") === ORIGINAL_REPLICAS,
    tryNext: "run /rewind and choose the point before the edit, so the file shows replicas: 3",
  },
] satisfies Rule[];
