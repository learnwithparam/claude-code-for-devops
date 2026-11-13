// bun run doctor: is this machine ready for the course?
// One line per tool: found, version, ok or what to do.
// Claude Code's version and sign-in come from `claude` itself, never from a credentials file.
import { CLAUDE_CODE } from "../config/claude";
import { claudeStatus } from "../world/lib/claude";

// True when version is the same as oldest or newer. Both look like "2.1.311".
function isAtLeast(version: string, oldest: string): boolean {
  const versionParts = version.split(".").map(Number);
  const oldestParts = oldest.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (versionParts[i] !== oldestParts[i]) return versionParts[i] > oldestParts[i];
  }
  return true;
}

let problems = 0;

function report(ok: boolean, what: string, detail: string) {
  if (!ok) problems++;
  const label = ok ? "ok  " : "FIX ";
  console.log(`  ${label}  ${what.padEnd(12)} ${detail}`);
}

function checkGit() {
  if (!Bun.which("git")) {
    report(false, "git", "not found: install git");
    return;
  }
  const gitRun = Bun.spawnSync(["git", "--version"], { stdout: "pipe", stderr: "pipe" });
  if (!gitRun.success) {
    report(false, "git", "not found: install git");
    return;
  }
  const gitVersion = gitRun.stdout.toString().trim().replace("git version ", "");
  report(true, "git", gitVersion);
}

function checkClaudeCode() {
  const status = claudeStatus();
  if (!status.installed) {
    report(
      false,
      "Claude Code",
      "not found: install it with the command in 00-orientation/README.md, " +
        "then open a new terminal",
    );
    report(false, "Signed in", "no: install Claude Code, run claude, then type /login");
    return;
  }
  const { oldest, newest } = CLAUDE_CODE;
  const tooOld = Boolean(status.version) && !isAtLeast(String(status.version), oldest);
  if (tooOld) {
    report(
      false,
      "Claude Code",
      `${status.version} is older than ${oldest}, the oldest version this course is tested on: ` +
        "run claude update",
    );
  } else {
    report(true, "Claude Code", `${status.version} (tested on ${oldest} to ${newest})`);
  }
  if (status.signedIn) {
    const how = status.how.replace(/^signed in ?/, "yes ").trim();
    report(true, "Signed in", how);
  } else {
    report(false, "Signed in", "no: run claude, then type /login");
  }
}

// On Linux and WSL the sandbox needs two programs. Without them, the finished settings
// (sandbox with failIfUnavailable) stop Claude Code before it starts.
function checkSandbox() {
  if (process.platform !== "linux") return;
  // Each program, and the package name you install it by.
  const needed = [
    { program: "bwrap", packageName: "bubblewrap" },
    { program: "socat", packageName: "socat" },
  ];
  const missing = needed.filter((tool) => !Bun.which(tool.program)).map((tool) => tool.packageName);
  if (missing.length === 0) {
    report(true, "Sandbox", "bubblewrap and socat found");
    return;
  }
  report(
    false,
    "Sandbox",
    `${missing.join(" and ")} not found: sudo apt-get install bubblewrap socat`,
  );
}

console.log("Checking your machine for the course.");
report(true, "Bun", Bun.version);
checkGit();
checkClaudeCode();
checkSandbox();
if (problems > 0) {
  console.log(
    `${problems} thing(s) to fix. ` +
      "Everything else in the course still runs: checks never need Claude Code.",
  );
} else {
  console.log("Ready. Claude Code is installed and signed in.");
}
process.exit(problems > 0 ? 1 : 0);
