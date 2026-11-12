// bun run demo: watch a real Claude Code session try to apply on prod, and the finished guard stop it.
// It plays the stream-json transcript of a recorded `claude -p` run (world/recordings/demo/run-1.jsonl). Each shell
// command in it is then fed again, as the same PreToolUse JSON, to the finished guard hook on your machine, so you
// see the hook decide it now. A replay runs nothing against the world.
// bun run demo --live runs the session again on your own signed-in Claude Code instead of the recording.
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { WORLD, repoDir, readLog } from "./sim/state";
import { seedInstance } from "./lib/seed";
import { mode, runClaude, transcript, RECORDINGS } from "./lib/claude";
import { DEMO_RUN } from "../config/claude";

const home = join(WORLD, ".finished", "demo");
seedInstance(home);
const repo = repoDir(home);
cpSync(join(WORLD, "finished", "overlay", ".claude"), join(repo, ".claude"), { recursive: true });

const wantLive = process.argv.includes("--live");
const m = mode();
if (wantLive && m.mode !== "live") console.log(`Cannot run live: ${m.why}.`);
const live = wantLive && m.mode === "live";
console.log(live ? `Running Claude Code live: ${m.why}.` : `Replaying a recorded Claude Code session (world/recordings/demo/run-1.jsonl).`);
const env = { TALLOWMARK_HOME: home, PATH: `${join(WORLD, "bin")}:${process.env.PATH}` };
const run = runClaude({ name: "demo/run-1", cwd: repo, prompt: DEMO_RUN.prompt, args: DEMO_RUN.args, env, live });

const hookEnv = { ...process.env, ...env, CLAUDE_PROJECT_DIR: repo };
console.log(`\n> ${DEMO_RUN.prompt}`);
for (const l of transcript(run.events)) {
  if (l.kind === "said") console.log(`\n  ${l.text.split("\n").join("\n  ")}`);
  if (l.kind === "result") console.log(l.text.split("\n").slice(0, 6).map((x) => `      ${x}`).join("\n"));
  if (l.kind === "blocked") console.log(`  BLOCKED  ${l.text.replace(/^.*?(Blocked by guard-infra)/s, "$1")}`);
  if (l.kind !== "tool") continue;
  console.log(`\n  ${l.text}`);
  if (l.call?.tool_name !== "Bash") continue;
  const payload = JSON.stringify({ session_id: "demo", cwd: repo, permission_mode: "acceptEdits", hook_event_name: "PreToolUse", ...l.call, tool_use_id: "toolu_demo" });
  const hook = Bun.spawnSync(["bun", join(repo, ".claude", "hooks", "guard-infra.ts")], { cwd: repo, env: hookEnv, stdin: new TextEncoder().encode(payload) });
  console.log(`    The finished guard, asked again now: ${hook.exitCode === 2 ? "blocks it" : "lets it through"}.`);
}
// The world's command log from that session: live, this world's; replayed, the one saved with the recording.
const saved = join(RECORDINGS, "demo", "run-1", "logs", "commands.jsonl");
if (live && process.env.CLAUDE_RECORD === "1") { mkdirSync(dirname(saved), { recursive: true }); cpSync(join(home, "logs", "commands.jsonl"), saved); }
const log = live ? readLog("commands.jsonl", home) : existsSync(saved) ? readFileSync(saved, "utf8").split("\n").filter(Boolean).map((x) => JSON.parse(x)) : [];
const changed = log.filter((e) => e.mutating && e.actor !== "ops-oncall").length;
console.log(`\nThe session is over. Changes it made to the world: ${changed}. A person applies.`);
