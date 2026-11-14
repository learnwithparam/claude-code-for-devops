import { join } from "node:path";
import {
  asList,
  codeLines,
  frontMatter,
  headings,
} from "./helpers/02-teach-the-repo/markdown";
import type { Rule } from "../scripts/verify";
import { decide, explain, read, ruleMatches, section, suite, WORK_REPO, WORLD } from "./lib";

const STEP = "write-a-runbook-skill";
const DEV = "kind-tallowmark-dev";
const FINISHED_GUARD = join(WORLD, "finished", "overlay");

// Writes Claude Code must never be allowed to run without asking. The shell starts on prod, so a
// command with no --context goes to prod too.
const PROD_WRITES = [
  "kubectl drain tallowmark-prod-control-plane --ignore-daemonsets --context kind-tallowmark-prod",
  "kubectl drain tallowmark-prod-control-plane --ignore-daemonsets",
  "kubectl cordon tallowmark-prod-control-plane --context kind-tallowmark-prod",
  "kubectl delete pod seat-api-10x7 -n seat --context kind-tallowmark-prod",
  "kubectl delete ns seat",
];
const FILE_WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];

const skill = (folder: string) => read(folder, ".claude", "skills", "drain-a-node", "SKILL.md");
const skillFields = (folder: string) => frontMatter(skill(folder)) ?? {};

// allowed-tools is a YAML list or one string such as "Bash(kubectl get *) Read".
function allowedTools(folder: string): string[] {
  const value = skillFields(folder)["allowed-tools"];
  if (typeof value === "string") return value.match(/\w+(\([^)]*\))?/g) ?? [];
  return asList(value);
}

const allowsWrite = (tools: string[], command: string) =>
  tools.some((tool) => ruleMatches(tool, "Bash", command));

// The commands in code blocks under "Commands Claude Code runs".
const claudeCommands = (folder: string) =>
  codeLines(section(skill(folder), "Commands Claude Code runs"));

async function guardBlocks(command: string): Promise<boolean> {
  // biome-ignore-start lint/style/useNamingConvention: a PreToolUse hook reads these exact names.
  const toolCall = {
    hook_event_name: "PreToolUse",
    cwd: WORK_REPO,
    tool_name: "Bash",
    tool_input: { command },
  };
  // biome-ignore-end lint/style/useNamingConvention: a PreToolUse hook reads these exact names.
  const decision = await decide(FINISHED_GUARD, "Bash", JSON.stringify(toolCall));
  return decision.blocked;
}

export default [
  {
    says: ".claude/skills/drain-a-node/SKILL.md has a name and a description",
    test: (folder) => {
      const fields = skillFields(folder);
      return Boolean(fields.name) && String(fields.description ?? "").length > 20;
    },
    tryNext: "ask for front matter with name: drain-a-node and a one-line description",
  },
  {
    says: "only a person can start it: disable-model-invocation is true",
    test: (folder) => skillFields(folder)["disable-model-invocation"] === true,
    tryNext: "add disable-model-invocation: true, so Claude Code never starts a drain by itself",
  },
  {
    says: "allowed-tools pre-approves no write on prod and no file edits",
    test: (folder) => {
      const tools = allowedTools(folder);
      const writesAllowed = PROD_WRITES.filter((command) => allowsWrite(tools, command));
      const fileTools = tools.filter((tool) => FILE_WRITE_TOOLS.includes(tool));
      explain(STEP, [...writesAllowed, ...fileTools]);
      return tools.length > 0 && writesAllowed.length === 0 && fileTools.length === 0;
    },
    tryNext:
      "list only reads that name the dev context, such as " +
      `Bash(kubectl get * --context ${DEV})`,
  },
  {
    says: `the skill names the dev context ${DEV}`,
    test: (folder) => skill(folder).includes(DEV),
    tryNext: `ask Claude Code to name --context ${DEV} on every kubectl line`,
  },
  {
    says: "the skill has a stop condition",
    test: (folder) => headings(skill(folder)).some((heading) => heading.includes("stop")),
    tryNext: 'ask for a "Stop if" section: wrong context, pods that will not move, or a prod node',
  },
  {
    says: "every kubectl line in the skill names the dev context",
    test: (folder) => {
      const kubectlLines = codeLines(skill(folder)).filter((line) => line.includes("kubectl"));
      const missing = kubectlLines.filter((line) => !line.includes(`--context ${DEV}`));
      explain(STEP, missing);
      return kubectlLines.length > 0 && missing.length === 0;
    },
    tryNext: "the shell starts on prod, so a kubectl line with no --context goes to prod",
  },
  {
    says: "every command Claude Code runs passes the finished guard",
    test: async (folder) => {
      const commands = claudeCommands(folder);
      const blocked: string[] = [];
      for (const command of commands) {
        if (await guardBlocks(command)) blocked.push(command);
      }
      explain(STEP, blocked);
      return commands.length > 0 && blocked.length === 0;
    },
    tryNext:
      'Claude Code runs only reads under "Commands Claude Code runs"; ' +
      'move cordon and drain to "Commands a person runs"',
  },
  {
    says: "the guard hook from part one still blocks 30 of 30 and allows 15 of 15",
    test: async (folder) => {
      const { score } = await suite(folder, ["dangerous", "bypass", "safe"]);
      return score.dangerous[0] + score.bypass[0] === 30 && score.safe[0] === 15;
    },
    tryNext: "keep the hook and its wiring in .claude/settings.json",
  },
] satisfies Rule[];
