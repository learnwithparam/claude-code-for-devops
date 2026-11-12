import type { Rule } from "../scripts/verify";
import { readSettings, denies, preToolHooks, suite, explain, cases } from "./lib";

const run = (d: string) => suite(d, ["dangerous", "safe"]);
const missed = async (d: string, set: string, want: boolean) => {
  const { results } = await run(d);
  const bad = results.filter((r) => r.set === set && r.ok !== want);
  const byId = new Map(cases().map((c) => [c.id, c]));
  explain("block-the-apply", bad.map((r) => `${r.id}: ${String(byId.get(r.id)?.tool_input.command ?? byId.get(r.id)?.tool_input.file_path)} (${r.how})`));
  return bad.length === 0;
};

export default [
  { says: "a PreToolUse hook is wired for the Bash tool", test: (d) => preToolHooks(d, "Bash").length > 0, tryNext: 'add hooks.PreToolUse with "matcher": "Bash" and your hook command to .claude/settings.json' },
  { says: "the same hook also sees the Read tool", test: (d) => preToolHooks(d, "Read").length > 0, tryNext: 'widen the matcher to "Bash|Read|Edit|Write" so a secret read reaches the hook too' },
  { says: "the hook blocks all 20 dangerous calls", test: (d) => missed(d, "dangerous", true), tryNext: "the lines above name each call that got through; block with exit 2, not exit 1" },
  { says: "the hook allows all 15 safe calls", test: (d) => missed(d, "safe", true), tryNext: "a guard that blocks plan, get or lint is a guard people switch off; match the verb, not the program name" },
  { says: "the hook blocks input it cannot read (fails closed)", test: async (d) => (await run(d)).score.malformed, tryNext: "wrap JSON.parse in try and exit 2 when it throws" },
  { says: "the deny rules from write-the-deny-rules are still there", test: (d) => denies(readSettings(d), "Bash", "terraform apply -auto-approve"), tryNext: "keep permissions.deny; the hook is a second layer, not a replacement" },
] satisfies Rule[];
