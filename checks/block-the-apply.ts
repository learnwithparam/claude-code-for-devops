import type { Rule } from "../scripts/verify";
import { type Case, cases, denies, explain, preToolHooks, readSettings, suite } from "./lib";

const runGuardSuite = (folder: string) => suite(folder, ["dangerous", "safe"]);

// What the planted call runs: the shell command, or the file it touches.
function plantedCallText(planted: Case | undefined): string {
  const input = planted?.tool_input;
  return String(input?.command ?? input?.file_path);
}

// True when every case in the set came out right. The wrong ones are printed under the FAIL.
async function allRight(folder: string, set: string): Promise<boolean> {
  const { results } = await runGuardSuite(folder);
  const wrongResults = results.filter((result) => result.set === set && !result.ok);
  const caseById = new Map(cases().map((planted) => [planted.id, planted]));
  const lines = wrongResults.map(
    (result) => `${result.id}: ${plantedCallText(caseById.get(result.id))} (${result.how})`,
  );
  explain("block-the-apply", lines);
  return wrongResults.length === 0;
}

export default [
  {
    says: "a PreToolUse hook is wired for the Bash tool",
    test: (folder) => preToolHooks(folder, "Bash").length > 0,
    tryNext:
      'add hooks.PreToolUse with "matcher": "Bash" and your hook command to .claude/settings.json',
  },
  {
    says: "the same hook also sees the Read tool",
    test: (folder) => preToolHooks(folder, "Read").length > 0,
    tryNext: 'widen the matcher to "Bash|Read|Edit|Write" so a secret read reaches the hook too',
  },
  {
    says: "the hook blocks all 20 dangerous calls",
    test: (folder) => allRight(folder, "dangerous"),
    tryNext: "the lines above name each call that got through; block with exit 2, not exit 1",
  },
  {
    says: "the hook allows all 15 safe calls",
    test: (folder) => allRight(folder, "safe"),
    tryNext:
      "a guard that blocks plan, get or lint is a guard people switch off; match the verb, not " +
      "the program name",
  },
  {
    says: "the hook blocks input it cannot read (fails closed)",
    test: async (folder) => (await runGuardSuite(folder)).score.malformed,
    tryNext: "wrap JSON.parse in try and exit 2 when it throws",
  },
  {
    says: "the deny rules from write-the-deny-rules are still there",
    test: (folder) => denies(readSettings(folder), "Bash", "terraform apply -auto-approve"),
    tryNext: "keep permissions.deny; the hook is a second layer, not a replacement",
  },
] satisfies Rule[];
