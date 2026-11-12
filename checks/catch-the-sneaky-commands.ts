import type { Rule } from "../scripts/verify";
import { type Case, cases, denies, explain, read, readSettings, suite } from "./lib";

const STEP = "catch-the-sneaky-commands";
const runGuardSuite = (folder: string) => suite(folder, ["dangerous", "bypass", "safe"]);

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
    (result) => `${result.id}: ${plantedCallText(caseById.get(result.id))}`,
  );
  explain(STEP, lines);
  return wrongResults.length === 0;
}

// The bypass cases that really get past this learner's own deny rules, as Claude Code matches them.
function realGaps(folder: string): string[] {
  const settings = readSettings(folder);
  const bypassCases = cases().filter((planted) => planted.set === "bypass");
  const missed = bypassCases.filter(
    (planted) => !denies(settings, "Bash", String(planted.tool_input.command)),
  );
  return missed.map((planted) => planted.id);
}

// The case ids the learner's note names, such as b03-chdir, each one once.
function namedInNote(folder: string): string[] {
  const note = read(folder, "notes", "deny-rule-gaps.md");
  const caseIds = note.match(/\bb\d\d-[A-Za-z0-9-]*[A-Za-z0-9]/g) ?? [];
  return [...new Set(caseIds)];
}

export default [
  {
    says: "notes/deny-rule-gaps.md names at least 3 bypass cases your deny rules miss",
    test: (folder) => {
      const gaps = realGaps(folder);
      return namedInNote(folder).filter((id) => gaps.includes(id)).length >= 3;
    },
    tryNext:
      "pick ids from world/guard/cases.jsonl (set bypass) and check each one against your deny list by hand",
  },
  {
    says: "every case the note names really gets past your deny rules",
    test: (folder) => {
      const named = namedInNote(folder);
      const gaps = realGaps(folder);
      const notGaps = named.filter((id) => !gaps.includes(id));
      explain(
        STEP,
        notGaps.map((id) => `${id} is stopped by your deny rules already`),
      );
      return named.length > 0 && notGaps.length === 0;
    },
    tryNext:
      "Claude Code strips env and similar wrappers and splits && before matching, so those forms are not gaps",
  },
  {
    says: "the hook blocks all 10 bypass forms",
    test: (folder) => allRight(folder, "bypass"),
    tryNext:
      "split on && ; |, strip env and paths, unwrap bash -c, skip flags before the verb, and read script files",
  },
  {
    says: "the hook still blocks all 20 dangerous calls",
    test: (folder) => allRight(folder, "dangerous"),
    tryNext: "rerun bun run verify block-the-apply to see which basic case broke",
  },
  {
    says: "the hook still allows all 15 safe calls",
    test: (folder) => allRight(folder, "safe"),
    tryNext: "match the verb after the flags (apply, destroy, delete), not the program name",
  },
  {
    says: "the hook still fails closed",
    test: async (folder) => (await runGuardSuite(folder)).score.malformed,
    tryNext: "exit 2 when the input is not JSON",
  },
] satisfies Rule[];
