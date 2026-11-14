// Reads batch.md, scripts/start-agents.sh and the reviewer agent. It starts no agent.
import { frontMatter, listField } from "../parts/03-give-it-eyes/helpers/front-matter";
import type { Rule } from "../scripts/verify";
import { read, section } from "./lib";

const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit", "MultiEdit"];
const MOST_UNITS = 3;

const script = (folder: string) => read(folder, "scripts", "start-agents.sh");
const agentLines = (folder: string) =>
  script(folder)
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .filter((line) => /^\s*claude\b/.test(line));

// Rows of the Units table: [unit, path, path...]. A path may list several, split by commas.
function units(folder: string): { name: string; paths: string[] }[] {
  const rows = section(read(folder, "batch.md"), "Units")
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*(-|Unit)/.test(line));
  return rows.map((row) => {
    const cells = row.split("|").map((cell) => cell.trim());
    return {
      name: cells[1],
      paths: (cells[2] ?? "")
        .split(",")
        .map((path) => path.trim())
        .filter(Boolean),
    };
  });
}

const overlaps = (first: string, second: string) =>
  first === second || first.startsWith(second) || second.startsWith(first);

function sharedPath(folder: string): boolean {
  const all = units(folder).flatMap((unit, index) => unit.paths.map((path) => ({ path, index })));
  return all.some((one) =>
    all.some((other) => one.index < other.index && overlaps(one.path, other.path)),
  );
}

const worktreeNames = (folder: string) =>
  agentLines(folder).map((line) => line.match(/\s-w\s+(\S+)/)?.[1] ?? "");

export default [
  {
    says: "batch.md has a /batch line",
    test: (folder) => /^\/batch\s+\S+/m.test(section(read(folder, "batch.md"), "Command")),
    tryNext: "put one line that starts /batch under the Command heading",
  },
  {
    says: `batch.md lists at least ${MOST_UNITS} units, each with a path`,
    test: (folder) =>
      units(folder).length >= MOST_UNITS && units(folder).every((unit) => unit.paths.length > 0),
    tryNext: "add a Units table with a row for each job and the paths it may change",
  },
  {
    says: "no path belongs to two units",
    test: (folder) => units(folder).length >= MOST_UNITS && !sharedPath(folder),
    tryNext: "give each unit its own file or folder, or merge two units into one",
  },
  {
    says: "the script starts at least three agents, each in its own worktree",
    test: (folder) => {
      const names = worktreeNames(folder);
      return (
        names.length >= MOST_UNITS && names.every(Boolean) && new Set(names).size === names.length
      );
    },
    tryNext: "start each agent with claude -w and a different name",
  },
  {
    says: "each agent runs in print mode with a permission mode and a turn limit",
    test: (folder) => {
      const lines = agentLines(folder);
      return (
        lines.length > 0 &&
        lines.every(
          (line) =>
            / -p /.test(line) && line.includes("--permission-mode") && line.includes("--max-turns"),
        )
      );
    },
    tryNext: "add -p, --permission-mode and --max-turns to every claude line",
  },
  {
    says: "the reviewer subagent cannot Edit or Write",
    test: (folder) => {
      const fields = frontMatter(read(folder, ".claude", "agents", "merge-reviewer.md"));
      const tools = listField(fields.tools);
      return (
        Boolean(fields.name) &&
        tools.length > 0 &&
        !tools.some((tool) => WRITE_TOOLS.includes(tool))
      );
    },
    tryNext: "set tools to Read, Grep, Glob and Bash in merge-reviewer.md",
  },
] satisfies Rule[];
