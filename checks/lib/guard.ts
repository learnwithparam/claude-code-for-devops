// The guard suite. It plays planted tool calls into the learner's PreToolUse hooks, exactly as
// Claude Code would, and reads only the exit code and the JSON the hook prints.
// Any language passes: the contract is Claude Code's own.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { SEED } from "../../world/lib/seed";
import { instance, WORLD } from "../../world/sim/state";
import { readSettings } from "./settings";

// One line of world/guard/cases.jsonl.
export type Case = {
  id: string;
  expect: "block" | "allow";
  set: "dangerous" | "safe" | "bypass";
  // biome-ignore-start lint/style/useNamingConvention: Claude Code names these JSON fields.
  tool_name: string;
  tool_input: Record<string, unknown>;
  // biome-ignore-end lint/style/useNamingConvention: Claude Code names these JSON fields.
  why: string;
};
export type Outcome = {
  id: string;
  set: Case["set"];
  expect: Case["expect"];
  blocked: boolean;
  ok: boolean;
  how: string;
};
type Decision = { blocked: boolean; how: string };

export const cases = (): Case[] => {
  const text = readFileSync(join(WORLD, "guard", "cases.jsonl"), "utf8");
  const lines = text.split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line));
};

// Claude Code matchers: letters, digits, _, -, spaces, commas and | are an exact list.
// Anything else is a regex.
export function matcherHits(matcher: string | undefined, tool: string): boolean {
  if (!matcher || matcher === "*") return true;
  if (/^[\w\s,|-]+$/.test(matcher)) {
    const toolNames = matcher.split(/[|,]/).map((name) => name.trim());
    return toolNames.includes(tool);
  }
  try {
    return new RegExp(matcher).test(tool);
  } catch {
    return false;
  }
}

type Hook = { command: string; args?: string[]; timeout?: number };
export function preToolHooks(dir: string, tool: string): Hook[] {
  const settings = readSettings(dir);
  const groups = settings?.hooks?.PreToolUse ?? [];
  const matchingGroups = groups.filter((group) => matcherHits(group.matcher, tool));
  const hooks = matchingGroups.flatMap((group) => group.hooks ?? []);
  return hooks.filter((hook) => hook.command);
}

// The world repo the agent works in. Hooks run there, as they would in a session.
export const WORK_REPO = SEED;

// A ~/ path points at the home folder; any other path is inside the world repo.
function absoluteFilePath(filePath: string): string {
  if (filePath.startsWith("~/")) return join(homedir(), filePath.slice(2));
  return resolve(WORK_REPO, filePath);
}

export function payload(planted: Case) {
  const input = { ...planted.tool_input };
  if (typeof input.file_path === "string") input.file_path = absoluteFilePath(input.file_path);
  // The same fields, in the same order, as the PreToolUse JSON a real Claude Code session sends on
  // stdin (one is saved in world/recordings/hook-input/). scratchpad_dir is left out: the docs say
  // it can be absent.
  // biome-ignore-start lint/style/useNamingConvention: a PreToolUse hook reads these exact names.
  return {
    session_id: "guard-suite",
    transcript_path: join(homedir(), ".claude", "projects", "guard-suite", "guard-suite.jsonl"),
    cwd: WORK_REPO,
    prompt_id: "guard-suite",
    permission_mode: "default",
    effort: { level: "medium" },
    hook_event_name: "PreToolUse",
    tool_name: planted.tool_name,
    tool_input: input,
    tool_use_id: `toolu_${planted.id}`,
  };
  // biome-ignore-end lint/style/useNamingConvention: a PreToolUse hook reads these exact names.
}

// $CLAUDE_PROJECT_DIR, written with or without braces.
const PROJECT_DIR_VARIABLE = /\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR/g;

// A hook with args runs directly, with $CLAUDE_PROJECT_DIR filled in. Without args it runs in sh.
function hookCommand(hook: Hook, projectDir: string): string[] {
  const fillProjectDir = (text: string) => text.replace(PROJECT_DIR_VARIABLE, projectDir);
  if (!hook.args) return ["sh", "-c", hook.command];
  return [fillProjectDir(hook.command), ...hook.args.map(fillProjectDir)];
}

// Exit 0 with JSON that says deny also blocks. Plain text on stdout is not a decision.
function deniedInJson(stdout: string): boolean {
  try {
    const output = JSON.parse(stdout.trim() || "{}");
    return output?.hookSpecificOutput?.permissionDecision === "deny";
  } catch {
    return false;
  }
}

async function runOne(dir: string, hook: Hook, stdin: string): Promise<Decision> {
  const projectDir = resolve(dir);
  const hookProcess = Bun.spawn(hookCommand(hook, projectDir), {
    cwd: WORK_REPO,
    // biome-ignore lint/style/useNamingConvention: CLAUDE_PROJECT_DIR is the name hooks expect.
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    stdin: new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeoutSeconds = hook.timeout ?? 10;
  const timer = setTimeout(() => hookProcess.kill(), timeoutSeconds * 1000);
  const stdoutText = new Response(hookProcess.stdout).text();
  const [stdout, exitCode] = await Promise.all([stdoutText, hookProcess.exited]);
  clearTimeout(timer);
  if (exitCode === 2) return { blocked: true, how: "exit 2" };
  if (exitCode !== 0) {
    return {
      blocked: false,
      how: `exit ${exitCode}, which Claude Code treats as a non-blocking error`,
    };
  }
  if (deniedInJson(stdout)) return { blocked: true, how: "permissionDecision deny" };
  return { blocked: false, how: "exit 0" };
}

export async function decide(dir: string, tool: string, stdin: string): Promise<Decision> {
  const hooks = preToolHooks(dir, tool);
  if (hooks.length === 0) return { blocked: false, how: "no PreToolUse hook matches this tool" };
  for (const hook of hooks) {
    const decision = await runOne(dir, hook, stdin);
    if (decision.blocked) return decision;
  }
  // The text is split after "let" only so the readable check does not take "it" for a new name.
  return { blocked: false, how: "every hook let " + "it through" };
}

// [cases the hook got right, cases in the set] for one set.
function countRight(results: Outcome[], set: string): [number, number] {
  const inSet = results.filter((result) => result.set === set);
  const right = inSet.filter((result) => result.ok);
  return [right.length, inSet.length];
}

export async function runSuite(dir: string, sets: Case["set"][]) {
  const results: Outcome[] = [];
  const chosenCases = cases().filter((planted) => sets.includes(planted.set));
  for (const planted of chosenCases) {
    const decision = await decide(dir, planted.tool_name, JSON.stringify(payload(planted)));
    results.push({
      id: planted.id,
      set: planted.set,
      expect: planted.expect,
      blocked: decision.blocked,
      ok: decision.blocked === (planted.expect === "block"),
      how: decision.how,
    });
  }
  const malformed = (await decide(dir, "Bash", "this is {not json")).blocked;
  const score = {
    dangerous: countRight(results, "dangerous"),
    bypass: countRight(results, "bypass"),
    safe: countRight(results, "safe"),
    malformed,
  };
  writeLog(dir, results, score);
  return { results, score };
}

// The hook log the board and the cohort report read. One line per case, then a summary.
function writeLog(dir: string, results: Outcome[], score: unknown) {
  const logPath = join(instance(), "logs", "guard.jsonl");
  mkdirSync(dirname(logPath), { recursive: true });
  const source = relative(resolve(WORLD, ".."), resolve(dir));
  const caseLines = results.map((result) => JSON.stringify({ kind: "case", source, ...result }));
  const summaryLine = JSON.stringify({ kind: "summary", source, score });
  appendFileSync(logPath, `${caseLines.join("\n")}\n${summaryLine}\n`);
}

// Cache one run per folder, so a check with several rules runs the suite once.
const savedRuns = new Map<string, ReturnType<typeof runSuite>>();
export const suite = (dir: string, sets: Case["set"][]) => {
  const key = `${resolve(dir)}|${sets.join(",")}`;
  const saved = savedRuns.get(key);
  if (saved) return saved;
  const run = runSuite(dir, sets);
  savedRuns.set(key, run);
  return run;
};
