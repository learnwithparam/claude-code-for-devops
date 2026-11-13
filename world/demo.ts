// bun run demo: watch a real Claude Code session try to apply on prod, and the finished guard
// stop it.
// It plays the stream-json transcript of a recorded `claude -p` run
// (world/recordings/demo/run-1.jsonl). Each shell command in it is then fed again, as the same
// PreToolUse JSON, to the finished guard hook on your machine, so you see the hook decide it now.
// A replay runs nothing against the world.
// bun run demo --live runs the session again on your own signed-in Claude Code instead of the
// recording.
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEMO_RUN } from "../config/claude";
import { type Line, mode, RECORDINGS, runClaude, transcript } from "./lib/claude";
import { seedInstance } from "./lib/seed";
import { readLog, repoDir, WORLD } from "./sim/state";

const home = join(WORLD, ".finished", "demo");
seedInstance(home);
const repo = repoDir(home);
cpSync(join(WORLD, "finished", "overlay", ".claude"), join(repo, ".claude"), { recursive: true });

const wantLive = process.argv.includes("--live");
const claudeMode = mode();
if (wantLive && claudeMode.mode !== "live") console.log(`Cannot run live: ${claudeMode.why}.`);
const live = wantLive && claudeMode.mode === "live";
if (live) console.log(`Running Claude Code live: ${claudeMode.why}.`);
else console.log("Replaying a recorded Claude Code session (world/recordings/demo/run-1.jsonl).");

// biome-ignore-start lint/style/useNamingConvention: environment variable names are upper case.
const env = { TALLOWMARK_HOME: home, PATH: `${join(WORLD, "bin")}:${process.env.PATH}` };
const hookEnv = { ...process.env, ...env, CLAUDE_PROJECT_DIR: repo };
// biome-ignore-end lint/style/useNamingConvention: environment variable names are upper case.
const run = runClaude({
  name: "demo/run-1",
  cwd: repo,
  prompt: DEMO_RUN.prompt,
  args: DEMO_RUN.args,
  env,
  live,
});

// Feed the call to the finished guard hook, as the same PreToolUse JSON Claude Code sends.
function askGuardNow(call: Line["call"]): string {
  // biome-ignore-start lint/style/useNamingConvention: Claude Code names these hook input fields.
  const payload = JSON.stringify({
    session_id: "demo",
    cwd: repo,
    permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse",
    ...call,
    tool_use_id: "toolu_demo",
  });
  // biome-ignore-end lint/style/useNamingConvention: Claude Code names these hook input fields.
  const hook = Bun.spawnSync(["bun", join(repo, ".claude", "hooks", "guard-infra.ts")], {
    cwd: repo,
    env: hookEnv,
    stdin: new TextEncoder().encode(payload),
  });
  // A guard hook blocks a call by exiting with code 2.
  return hook.exitCode === 2 ? "blocks it" : "lets it through";
}

function showToolResult(text: string) {
  const firstLines = text.split("\n").slice(0, 6);
  console.log(firstLines.map((resultLine) => `      ${resultLine}`).join("\n"));
}

function showLine(line: Line) {
  if (line.kind === "said") console.log(`\n  ${line.text.split("\n").join("\n  ")}`);
  if (line.kind === "result") showToolResult(line.text);
  if (line.kind === "blocked")
    console.log(`  BLOCKED  ${line.text.replace(/^.*?(Blocked by guard-infra)/s, "$1")}`);
  if (line.kind !== "tool") return;
  console.log(`\n  ${line.text}`);
  if (line.call?.tool_name !== "Bash") return;
  console.log(`    The finished guard, asked again now: ${askGuardNow(line.call)}.`);
}

console.log(`\n> ${DEMO_RUN.prompt}`);
for (const line of transcript(run.events)) showLine(line);

// The world's command log from that session: live, this world's; replayed, the one saved with
// the recording.
const saved = join(RECORDINGS, "demo", "run-1", "logs", "commands.jsonl");
if (live && process.env.CLAUDE_RECORD === "1") {
  mkdirSync(dirname(saved), { recursive: true });
  cpSync(join(home, "logs", "commands.jsonl"), saved);
}

type LogEntry = { mutating?: boolean; actor?: string };
function readSavedLog(): LogEntry[] {
  if (!existsSync(saved)) return [];
  const lines = readFileSync(saved, "utf8").split("\n").filter(Boolean);
  return lines.map((logLine) => JSON.parse(logLine));
}

const commandLog: LogEntry[] = live ? readLog("commands.jsonl", home) : readSavedLog();
const changed = commandLog.filter((entry) => entry.mutating && entry.actor !== "ops-oncall").length;
console.log(`\nThe session is over. Changes it made to the world: ${changed}. A person applies.`);
