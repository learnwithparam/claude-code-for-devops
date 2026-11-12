// bun run record: make every recording the course replays, on your own signed-in Claude Code.
// Each one is a real `claude -p` run saved as its stream-json transcript, plus the files and world logs it produced.
// See RECORD.md in this folder for each command, the folder it runs in and where the output goes.
import { join } from "node:path";
import { RUNS } from "../../config/claude";
import { mode } from "../lib/claude";

const HOOK_PROMPT = "Run git status, then read README.md. Then stop.";

const m = mode();
if (m.mode !== "live") {
  console.log(`Cannot record: ${m.why}. Install Claude Code, run claude, then /login, and try again.`);
  process.exit(1);
}
console.log(`Recording on ${m.why}.`);
const ROOT = join(import.meta.dir, "..", "..");
const env = { ...process.env, CLAUDE_RECORD: "1", CLAUDE_REPLAY: "", CI: "" };
let failed = 0;
for (let i = 1; i <= RUNS; i++) {
  console.log(`\nFinished system, run ${i} of ${RUNS}: the plan review on 6 plans and the drifted-world session.`);
  const p = Bun.spawnSync(["bun", "world/finished.ts"], { cwd: ROOT, env: { ...env, CLAUDE_RUN: String(i) }, stdout: "pipe", stderr: "pipe" });
  const out = p.stdout.toString();
  process.stdout.write(out.split("\n").filter((l) => /PASS|FAIL|Plan review|Claude Code/.test(l)).join("\n") + "\n");
  if (!p.success) failed++;
}
console.log(`\nDemo: the apply request on prod.`);
const d = Bun.spawnSync(["bun", "world/demo.ts", "--live"], { cwd: ROOT, env, stdout: "pipe", stderr: "pipe" });
process.stdout.write(d.stdout.toString().split("\n").filter((l) => /BLOCKED|session is over/.test(l)).join("\n") + "\n");
if (!d.success) failed++;
// The exact JSON Claude Code hands a PreToolUse hook, saved so the guard suite's planted calls can be compared with it.
console.log(`\nHook input: what Claude Code sends a PreToolUse hook on stdin.`);
{
  const { seedInstance } = await import("../lib/seed");
  const { readdirSync, readFileSync, writeFileSync, mkdirSync } = await import("node:fs");
  const home = join(ROOT, "world", ".finished", "hook-probe");
  seedInstance(home, join(ROOT, "world", "finished", "overlay"));
  const repo = join(home, "tallowmark-infra");
  const dump = join(home, "hook-input");
  mkdirSync(dump, { recursive: true });
  writeFileSync(join(repo, ".claude", "settings.local.json"), JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash|Read", hooks: [{ type: "command", command: `cat > "${dump}/$(date +%s%N).json"` }] }] } }, null, 2));
  const { runClaude } = await import("../lib/claude");
  runClaude({ name: "hook-input/session", cwd: repo, prompt: HOOK_PROMPT, args: ["--allowedTools", "Bash(git status)", "Read", "--max-turns", "4"], env: { CLAUDE_RECORD: "" }, live: true });
  const got = readdirSync(dump).sort().map((f) => JSON.parse(readFileSync(join(dump, f), "utf8")));
  const out = join(import.meta.dir, "hook-input");
  mkdirSync(out, { recursive: true });
  for (const tool of ["Bash", "Read"]) {
    const j = got.find((x) => x.tool_name === tool);
    if (j) writeFileSync(join(out, `pretooluse-${tool.toLowerCase()}.json`), JSON.stringify(j, null, 2) + "\n");
    else { failed++; console.log(`  FAIL  no ${tool} hook input was captured`); }
  }
  console.log(`  saved ${got.length} hook input(s) under world/recordings/hook-input`);
}
console.log(failed ? `\n${failed} recording(s) did not pass their checks. Look at them before you commit.` : `\nEvery recording is saved under world/recordings and passed its checks.`);
process.exit(failed ? 1 : 0);
