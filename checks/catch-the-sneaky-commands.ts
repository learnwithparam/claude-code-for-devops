import type { Rule } from "../scripts/verify";
import { cases, denies, explain, read, readSettings, suite } from "./lib";

const run = (d: string) => suite(d, ["dangerous", "bypass", "safe"]);
const allOk = async (d: string, set: string) => {
  const { results } = await run(d);
  const bad = results.filter((r) => r.set === set && !r.ok);
  const byId = new Map(cases().map((c) => [c.id, c]));
  explain(
    "catch-the-sneaky-commands",
    bad.map(
      (r) =>
        `${r.id}: ${String(byId.get(r.id)?.tool_input.command ?? byId.get(r.id)?.tool_input.file_path)}`,
    ),
  );
  return bad.length === 0;
};
// The bypass cases that really get past this learner's own deny rules, as Claude Code matches them.
const realGaps = (d: string) =>
  cases()
    .filter(
      (c) => c.set === "bypass" && !denies(readSettings(d), "Bash", String(c.tool_input.command)),
    )
    .map((c) => c.id);
const named = (d: string) => [
  ...new Set(
    read(d, "notes", "deny-rule-gaps.md").match(/\bb\d\d-[A-Za-z0-9-]*[A-Za-z0-9]/g) ?? [],
  ),
];

export default [
  {
    says: "notes/deny-rule-gaps.md names at least 3 bypass cases your deny rules miss",
    test: (d) => named(d).filter((id) => realGaps(d).includes(id)).length >= 3,
    tryNext:
      "pick ids from world/guard/cases.jsonl (set bypass) and check each one against your deny list by hand",
  },
  {
    says: "every case the note names really gets past your deny rules",
    test: (d) => {
      const wrong = named(d).filter((id) => !realGaps(d).includes(id));
      explain(
        "catch-the-sneaky-commands",
        wrong.map((id) => `${id} is stopped by your deny rules already`),
      );
      return named(d).length > 0 && wrong.length === 0;
    },
    tryNext:
      "Claude Code strips env and similar wrappers and splits && before matching, so those forms are not gaps",
  },
  {
    says: "the hook blocks all 10 bypass forms",
    test: (d) => allOk(d, "bypass"),
    tryNext:
      "split on && ; |, strip env and paths, unwrap bash -c, skip flags before the verb, and read script files",
  },
  {
    says: "the hook still blocks all 20 dangerous calls",
    test: (d) => allOk(d, "dangerous"),
    tryNext: "rerun bun run verify block-the-apply to see which basic case broke",
  },
  {
    says: "the hook still allows all 15 safe calls",
    test: (d) => allOk(d, "safe"),
    tryNext: "match the verb after the flags (apply, destroy, delete), not the program name",
  },
  {
    says: "the hook still fails closed",
    test: async (d) => (await run(d)).score.malformed,
    tryNext: "exit 2 when the input is not JSON",
  },
] satisfies Rule[];
