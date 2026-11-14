// Runs the learner's own cases through their kit's hook, in a fresh folder. The cases come from the
// learner's repo. The check reads the course cases only to tell that the learner wrote new ones.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { type Case, cases, decide, explain, payload, read } from "./lib";

const STEP = "run-the-kit-on-your-repo";
const SAMPLE_BLOCKED = 5;
const SAMPLE_ALLOWED = 3;

type Own = Pick<Case, "id" | "expect" | "tool_name" | "tool_input">;
type Tally = { blocked: [number, number]; allowed: [number, number]; wrong: string[] };

function ownCases(folder: string): Own[] {
  const lines = read(folder, "own-cases.jsonl").split("\n").filter(Boolean);
  try {
    return lines.map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

const commandOf = (item: Own) => String(item.tool_input?.command ?? "");
const courseCommands = () => new Set(cases().map((item) => String(item.tool_input.command ?? "")));
const isWellFormed = (item: Own) =>
  Boolean(item.id) && ["block", "allow"].includes(item.expect) && Boolean(item.tool_name) && typeof item.tool_input === "object";

async function tally(folder: string): Promise<Tally | null> {
  if (!existsSync(join(folder, "kit", "settings.json"))) return null;
  const root = mkdtempSync(join(tmpdir(), "own-kit-"));
  try {
    mkdirSync(join(root, ".claude"), { recursive: true });
    cpSync(join(folder, "kit", "settings.json"), join(root, ".claude", "settings.json"));
    const hooks = join(folder, "kit", "hooks");
    if (existsSync(hooks)) cpSync(hooks, join(root, ".claude", "hooks"), { recursive: true });
    const result: Tally = { blocked: [0, 0], allowed: [0, 0], wrong: [] };
    for (const item of ownCases(folder)) {
      const planted = { ...item, set: "dangerous", why: "" } as Case;
      const decision = await decide(root, item.tool_name, JSON.stringify(payload(planted)));
      const side = item.expect === "block" ? result.blocked : result.allowed;
      side[1] += 1;
      if (decision.blocked === (item.expect === "block")) side[0] += 1;
      else result.wrong.push(`${item.id}: ${commandOf(item)}`);
    }
    return result;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const saved = new Map<string, Promise<Tally | null>>();
const tallyOf = (folder: string) => {
  if (!saved.has(folder)) saved.set(folder, tally(folder));
  return saved.get(folder) as Promise<Tally | null>;
};
const claimed = (folder: string, word: string): [number, number] | null => {
  const found = read(folder, "own-results.md").match(new RegExp(`${word}:\\s*(\\d+) of (\\d+)`, "i"));
  return found ? [Number(found[1]), Number(found[2])] : null;
};

export default [
  {
    says: "own-cases.jsonl is well formed",
    test: (folder) => {
      const items = ownCases(folder);
      return items.length > 0 && items.every(isWellFormed);
    },
    tryNext: "write one JSON object per line with id, expect, tool_name, tool_input and why",
  },
  {
    says: `own-cases.jsonl has at least ${SAMPLE_BLOCKED} calls to block and ${SAMPLE_ALLOWED} to allow`,
    test: (folder) => {
      const items = ownCases(folder);
      const blocks = items.filter((item) => item.expect === "block").length;
      return blocks >= SAMPLE_BLOCKED && items.length - blocks >= SAMPLE_ALLOWED;
    },
    tryNext: "add more commands from your repo until you have five to block and three to allow",
  },
  {
    says: "at least three commands are new, not from the course cases",
    test: (folder) => {
      const course = courseCommands();
      return ownCases(folder).filter((item) => !course.has(commandOf(item))).length >= 3;
    },
    tryNext: "read your own scripts and CI files, and use commands that appear there",
  },
  {
    says: "in a fresh folder the kit gets every one of your cases right",
    test: async (folder) => {
      const result = await tallyOf(folder);
      if (result) explain(STEP, result.wrong);
      return result !== null && result.wrong.length === 0 && result.blocked[1] + result.allowed[1] > 0;
    },
    tryNext: "fix the hook for each wrong line, or move a safe command out of the block list",
  },
  {
    says: "own-results.md names the repo",
    test: (folder) => /^Repo:\s*\S{3,}/m.test(read(folder, "own-results.md")),
    tryNext: "write Repo: and a short name for the repo you took the cases from",
  },
  {
    says: "own-results.md counts match a real run",
    test: async (folder) => {
      const result = await tallyOf(folder);
      const blocked = claimed(folder, "Blocked");
      const allowed = claimed(folder, "Allowed");
      if (!(result && blocked && allowed)) return false;
      return blocked.join() === result.blocked.join() && allowed.join() === result.allowed.join();
    },
    tryNext: "run the cases again and copy the real counts into Blocked and Allowed",
  },
] satisfies Rule[];
