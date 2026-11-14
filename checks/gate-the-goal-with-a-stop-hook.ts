// Reads SPEC.md, goal.txt, the Stop hook and the reviewer subagent. It runs the hook in a fresh
// folder with its own two specs, one that fails and one that passes. It never runs your Check line.
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frontMatter, listField } from "../parts/03-give-it-eyes/helpers/front-matter";
import type { Rule } from "../scripts/verify";
import { read, readSettings, section } from "./lib";

const SPEC = (folder: string) => read(folder, "SPEC.md");
const CHANGES = /\b(apply|destroy|import|delete|rm)\b/;
const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];

type Hook = { command: string };
const stopHook = (folder: string): Hook | undefined =>
  readSettings(folder)?.hooks?.Stop?.[0]?.hooks?.[0];
const checkLine = (folder: string) =>
  SPEC(folder)
    .match(/^Check:\s*(.+)$/m)?.[1]
    ?.trim() ?? "";

// Runs the learner's hook in a fresh folder whose SPEC.md has the given Check line.
async function runGate(folder: string, check: string, stdin: string): Promise<number | null> {
  const hook = stopHook(folder);
  if (!hook || !existsSync(join(folder, ".claude", "hooks"))) return null;
  const root = mkdtempSync(join(tmpdir(), "stop-gate-"));
  try {
    mkdirSync(join(root, ".claude"), { recursive: true });
    cpSync(join(folder, ".claude", "hooks"), join(root, ".claude", "hooks"), { recursive: true });
    writeFileSync(join(root, "SPEC.md"), `# Spec\n\nCheck: ${check}\n`);
    const run = Bun.spawn(["sh", "-c", hook.command], {
      cwd: root,
      // biome-ignore lint/style/useNamingConvention: the name hooks expect.
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      stdin: new TextEncoder().encode(stdin),
      stdout: "pipe",
      stderr: "pipe",
    });
    const timer = setTimeout(() => run.kill(), 10_000);
    const code = await run.exited;
    clearTimeout(timer);
    return code;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// biome-ignore-start lint/style/useNamingConvention: Claude Code names these JSON fields.
const normal = JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false });
const second = JSON.stringify({ hook_event_name: "Stop", stop_hook_active: true });
// biome-ignore-end lint/style/useNamingConvention: Claude Code names these JSON fields.

export default [
  {
    says: "SPEC.md has Goal, Done when and Out of scope",
    test: (folder) =>
      ["Goal", "Done when", "Out of scope"].every(
        (heading) => section(SPEC(folder), heading).length > 10,
      ),
    tryNext: "ask Claude Code to interview you, then write the three sections",
  },
  {
    says: "Done when holds one read-only Check: line",
    test: (folder) => {
      const line = checkLine(folder);
      return (
        line.length > 3 &&
        !CHANGES.test(line) &&
        section(SPEC(folder), "Done when").includes("Check:")
      );
    },
    tryNext: "add a line that starts Check: with a command that reads, such as terraform plan",
  },
  {
    says: "the Stop hook blocks when the check fails",
    test: async (folder) => (await runGate(folder, "false", normal)) === 2,
    tryNext: "wire a Stop hook that runs the Check line and exits 2 when it fails",
  },
  {
    says: "the Stop hook lets Claude Code stop when the check passes",
    test: async (folder) => (await runGate(folder, "true", normal)) === 0,
    tryNext: "exit 0 when the Check command passes",
  },
  {
    says: "the Stop hook lets a second stop through, so it cannot loop",
    test: async (folder) => (await runGate(folder, "false", second)) === 0,
    tryNext: "exit 0 at once when stop_hook_active is true",
  },
  {
    says: "goal.txt has a /goal line that names the Check line, a turn limit and /code-review",
    test: (folder) => {
      const goal = read(folder, "goal.txt");
      const readsSpec = /Check line|SPEC\.md/.test(goal);
      return (
        goal.startsWith("/goal") &&
        readsSpec &&
        /\d+ turns/.test(goal) &&
        goal.includes("/code-review")
      );
    },
    tryNext:
      "write /goal, then the work, the Check line, a turn limit like 12 turns, and /code-review",
  },
  {
    says: "the reviewer subagent cannot Edit or Write",
    test: (folder) => {
      const fields = frontMatter(read(folder, ".claude", "agents", "code-reviewer.md")) ?? {};
      const tools = listField(fields.tools);
      return (
        Boolean(fields.name) &&
        tools.length > 0 &&
        !tools.some((tool) => WRITE_TOOLS.includes(tool))
      );
    },
    tryNext: "set tools to Read, Grep, Glob and Bash in code-reviewer.md",
  },
] satisfies Rule[];
