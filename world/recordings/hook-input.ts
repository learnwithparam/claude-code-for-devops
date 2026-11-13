// The exact JSON Claude Code hands a PreToolUse hook on stdin, saved so the guard suite's planted calls can be
// compared with it (tests/claude.test.ts). Runs a real session in the finished repo with one extra local hook that
// saves its stdin. Part of bun run record; run alone with bun world/recordings/hook-input.ts.
import { join } from "node:path";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { seedInstance } from "../lib/seed";
import { mode, runClaude } from "../lib/claude";

const m = mode();
if (m.mode !== "live") { console.log(`Cannot record: ${m.why}.`); process.exit(1); }
const ROOT = join(import.meta.dir, "..", "..");
const home = join(ROOT, "world", ".finished", "hook-probe");
seedInstance(home, join(ROOT, "world", "finished", "overlay"));
const repo = join(home, "tallowmark-infra");
const dump = join(home, "hook-input");
mkdirSync(dump, { recursive: true });
writeFileSync(join(repo, ".claude", "settings.local.json"), JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash|Read", hooks: [{ type: "command", command: `cat > "${dump}/$(date +%s%N).json"` }] }] } }, null, 2));
delete process.env.CLAUDE_RECORD;
runClaude({ name: "hook-input/session", cwd: repo, prompt: "Run git status, then read README.md. Then stop.", args: ["--allowedTools", "Bash(git status)", "Read", "--max-turns", "4"], live: true });
const got = readdirSync(dump).sort().map((f) => JSON.parse(readFileSync(join(dump, f), "utf8")));
const out = join(import.meta.dir, "hook-input");
mkdirSync(out, { recursive: true });
let missing = 0;
for (const tool of ["Bash", "Read"]) {
  const j = got.find((x) => x.tool_name === tool);
  if (j) writeFileSync(join(out, `pretooluse-${tool.toLowerCase()}.json`), JSON.stringify(j, null, 2) + "\n");
  else { missing++; console.log(`  FAIL  no ${tool} hook input was captured`); }
}
console.log(`  saved ${got.length} hook input(s) under world/recordings/hook-input`);
process.exit(missing ? 1 : 0);
