// bun run doctor: is this machine ready for the course? One line per tool: found, version, ok or what to do.
// Claude Code's version and sign-in come from `claude` itself, never from a credentials file.
import { CLAUDE_CODE } from "../config/claude";
import { claudeStatus } from "../world/lib/claude";

const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return true;
};
let problems = 0;
const line = (ok: boolean, what: string, detail: string) => { if (!ok) problems++; console.log(`  ${ok ? "ok  " : "FIX "}  ${what.padEnd(12)} ${detail}`); };

console.log("Checking your machine for the course.");
line(true, "Bun", Bun.version);
const git = Bun.which("git") ? Bun.spawnSync(["git", "--version"], { stdout: "pipe", stderr: "pipe" }) : null;
line(!!git?.success, "git", git?.success ? git.stdout.toString().trim().replace("git version ", "") : "not found: install git");

const s = claudeStatus();
if (!s.installed) {
  line(false, "Claude Code", "not found: install it with the command in 00-orientation/README.md, then open a new terminal");
  line(false, "Signed in", "no: install Claude Code, run claude, then type /login");
}
else {
  const old = s.version && !newer(s.version, CLAUDE_CODE.oldest);
  line(!old, "Claude Code", old ? `${s.version} is older than ${CLAUDE_CODE.oldest}, the oldest version this course is tested on: run claude update` : `${s.version} (tested on ${CLAUDE_CODE.oldest} to ${CLAUDE_CODE.newest})`);
  line(s.signedIn, "Signed in", s.signedIn ? s.how.replace(/^signed in ?/, "yes ").trim() : "no: run claude, then type /login");
}
console.log(problems ? `${problems} thing(s) to fix. Everything else in the course still runs: checks never need Claude Code.` : "Ready. Claude Code is installed and signed in.");
process.exit(problems ? 1 : 0);
