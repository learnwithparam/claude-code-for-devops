// bun run demo: replay a recorded Claude Code session on the finished repo.
// The agent's words are recorded. Every tool call is real: it goes through the finished guard hook,
// and the calls the hook allows run against the world (using a drifted copy, so there is something to find).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WORLD, repoDir } from "./sim/state";
import { seedInstance } from "./lib/seed";

const home = join(WORLD, ".finished", "demo");
seedInstance(home);
// The drifted world, with the finished guard installed.
const repo = repoDir(home);
const { cpSync } = await import("node:fs");
cpSync(join(WORLD, "finished", "overlay", ".claude"), join(repo, ".claude"), { recursive: true });

const steps = JSON.parse(readFileSync(join(WORLD, "demo", "session.json"), "utf8"));
const env = { ...process.env, TALLOWMARK_HOME: home, CLAUDE_PROJECT_DIR: repo, PATH: `${join(WORLD, "bin")}:${process.env.PATH}` };
for (const s of steps) {
  if (s.who === "you") console.log(`\n> ${s.text}`);
  if (s.who === "agent") console.log(`\n  ${s.text}`);
  if (s.who !== "tool") continue;
  console.log(`\n  Bash: ${s.call.tool_input.command}`);
  const payload = JSON.stringify({ hook_event_name: "PreToolUse", cwd: repo, ...s.call });
  const hook = Bun.spawnSync(["bun", join(repo, ".claude", "hooks", "guard-infra.ts")], { cwd: repo, env, stdin: new TextEncoder().encode(payload) });
  if (hook.exitCode === 2) { console.log(`  BLOCKED  ${hook.stderr.toString().trim()}`); continue; }
  const run = Bun.spawnSync(["sh", "-c", s.call.tool_input.command], { cwd: repo, env });
  const text = (run.stdout.toString() + run.stderr.toString()).trim().split("\n").map((l) => `    ${l}`).join("\n");
  console.log(text);
}
console.log(`\nThe recorded session is over. Nothing was applied: run bun run board to see prod still drifted in your own world.`);
