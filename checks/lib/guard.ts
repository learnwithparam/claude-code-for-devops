// The guard suite. It plays planted tool calls into the learner's PreToolUse hooks, exactly as Claude Code would,
// and reads only the exit code and the JSON the hook prints. Any language passes: the contract is Claude Code's own.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve, dirname } from "node:path";
import { readSettings } from "./settings";
import { SEED } from "../../world/lib/seed";
import { instance, WORLD } from "../../world/sim/state";

export type Case = { id: string; expect: "block" | "allow"; set: "dangerous" | "safe" | "bypass"; tool_name: string; tool_input: Record<string, unknown>; why: string };
export type Outcome = { id: string; set: Case["set"]; expect: Case["expect"]; blocked: boolean; ok: boolean; how: string };

export const cases = (): Case[] =>
  readFileSync(join(WORLD, "guard", "cases.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

// Claude Code matchers: letters, digits, _, -, spaces, commas and | are an exact list. Anything else is a regex.
export function matcherHits(matcher: string | undefined, tool: string): boolean {
  if (!matcher || matcher === "*") return true;
  if (/^[\w\s,|-]+$/.test(matcher)) return matcher.split(/[|,]/).map((s) => s.trim()).includes(tool);
  try { return new RegExp(matcher).test(tool); } catch { return false; }
}

type Hook = { command: string; args?: string[]; timeout?: number };
export function preToolHooks(dir: string, tool: string): Hook[] {
  const s = readSettings(dir);
  return (s?.hooks?.PreToolUse ?? []).filter((g) => matcherHits(g.matcher, tool)).flatMap((g) => g.hooks ?? []).filter((h) => h.command);
}

// The world repo the agent works in. Hooks run there, as they would in a session.
export const WORK_REPO = SEED;

export function payload(c: Case) {
  const input = { ...c.tool_input };
  if (typeof input.file_path === "string") {
    const f = input.file_path as string;
    input.file_path = f.startsWith("~/") ? join(homedir(), f.slice(2)) : resolve(WORK_REPO, f);
  }
  // The same fields, in the same order, as the PreToolUse JSON a real Claude Code session sends on stdin
  // (one is saved in world/recordings/hook-input/). scratchpad_dir is left out: the docs say it can be absent.
  return {
    session_id: "guard-suite",
    transcript_path: join(homedir(), ".claude", "projects", "guard-suite", "guard-suite.jsonl"),
    cwd: WORK_REPO,
    prompt_id: "guard-suite",
    permission_mode: "default",
    effort: { level: "medium" },
    hook_event_name: "PreToolUse",
    tool_name: c.tool_name,
    tool_input: input,
    tool_use_id: `toolu_${c.id}`,
  };
}

async function runOne(dir: string, hook: Hook, stdin: string): Promise<{ blocked: boolean; how: string }> {
  const projectDir = resolve(dir);
  const sub = (s: string) => s.replaceAll("${CLAUDE_PROJECT_DIR}", projectDir).replaceAll("$CLAUDE_PROJECT_DIR", projectDir);
  const cmd = hook.args ? [sub(hook.command), ...hook.args.map(sub)] : ["sh", "-c", hook.command];
  const proc = Bun.spawn(cmd, {
    cwd: WORK_REPO,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    stdin: new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => proc.kill(), (hook.timeout ?? 10) * 1000);
  const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  clearTimeout(timer);
  if (code === 2) return { blocked: true, how: "exit 2" };
  if (code === 0) {
    try {
      const j = JSON.parse(stdout.trim() || "{}");
      if (j?.hookSpecificOutput?.permissionDecision === "deny") return { blocked: true, how: "permissionDecision deny" };
    } catch { /* plain text on stdout is not a decision */ }
    return { blocked: false, how: "exit 0" };
  }
  return { blocked: false, how: `exit ${code}, which Claude Code treats as a non-blocking error` };
}

export async function decide(dir: string, tool: string, stdin: string) {
  const hooks = preToolHooks(dir, tool);
  if (!hooks.length) return { blocked: false, how: "no PreToolUse hook matches this tool" };
  for (const h of hooks) {
    const r = await runOne(dir, h, stdin);
    if (r.blocked) return r;
  }
  return { blocked: false, how: "every hook let it through" };
}

export async function runSuite(dir: string, sets: Case["set"][]) {
  const results: Outcome[] = [];
  for (const c of cases().filter((c) => sets.includes(c.set))) {
    const r = await decide(dir, c.tool_name, JSON.stringify(payload(c)));
    results.push({ id: c.id, set: c.set, expect: c.expect, blocked: r.blocked, ok: r.blocked === (c.expect === "block"), how: r.how });
  }
  const malformed = (await decide(dir, "Bash", "this is {not json")).blocked;
  const count = (set: string) => {
    const xs = results.filter((r) => r.set === set);
    return [xs.filter((r) => r.ok).length, xs.length] as [number, number];
  };
  const score = { dangerous: count("dangerous"), bypass: count("bypass"), safe: count("safe"), malformed };
  writeLog(dir, results, score);
  return { results, score };
}

// The hook log the board and the cohort report read. One line per case, then a summary.
function writeLog(dir: string, results: Outcome[], score: unknown) {
  const p = join(instance(), "logs", "guard.jsonl");
  mkdirSync(dirname(p), { recursive: true });
  const source = relative(resolve(WORLD, ".."), resolve(dir));
  appendFileSync(p, results.map((r) => JSON.stringify({ kind: "case", source, ...r })).join("\n") + "\n" + JSON.stringify({ kind: "summary", source, score }) + "\n");
}

// Cache one run per folder, so a check with several rules runs the suite once.
const memo = new Map<string, ReturnType<typeof runSuite>>();
export const suite = (dir: string, sets: Case["set"][]) => {
  const key = `${resolve(dir)}|${sets.join(",")}`;
  if (!memo.has(key)) memo.set(key, runSuite(dir, sets));
  return memo.get(key)!;
};
