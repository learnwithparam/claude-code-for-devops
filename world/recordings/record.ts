// bun run record: make every recording the course replays, on your own signed-in Claude Code.
// Each one is a real `claude -p` run saved as its stream-json transcript, plus the files and world logs it produced.
// See RECORD.md in this folder for each command, the folder it runs in and where the output goes.
import { join } from "node:path";
import { RUNS } from "../../config/claude";
import { mode } from "../lib/claude";

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
console.log(`\nHook input: what Claude Code sends a PreToolUse hook on stdin.`);
const h = Bun.spawnSync(["bun", "world/recordings/hook-input.ts"], { cwd: ROOT, env, stdout: "inherit", stderr: "inherit" });
if (!h.success) failed++;
console.log(failed ? `\n${failed} recording(s) did not pass their checks. Look at them before you commit.` : `\nEvery recording is saved under world/recordings and passed its checks.`);
process.exit(failed ? 1 : 0);
