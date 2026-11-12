import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { decide, ensureWorld, read, section, WORLD } from "./lib";

const note = (folder: string) => read(folder, "notes", "first-look.md");
const HEADINGS = [
  "Where my shell points",
  "The fault that worries me most",
  "A command I would never let an agent run",
];
const [SHELL_HEADING, FAULT_HEADING, COMMAND_HEADING] = HEADINGS;
const FAULT_WORDS = [
  "drift",
  "buyer records",
  "chart",
  "seat-api",
  "probe",
  "alert",
  "SeatApiSlow",
  "cost",
  "lifecycle",
  "autoscaler",
  "scan",
  "pipeline",
  "\\bCI\\b",
  "workflow",
];
const FAULTS = new RegExp(FAULT_WORDS.join("|"), "i");

// The answer comes from the world itself: the env its .envrc points the shell at.
function worldEnv(): string {
  const home = ensureWorld();
  const envrc = readFileSync(join(home, "tallowmark-infra", ".envrc"), "utf8");
  return /TALLOWMARK_ENV=(\w+)/.exec(envrc)?.[1] ?? "prod";
}

// The one command under the third heading: the first line of a code block, or the first `code`.
function namedCommand(folder: string): string {
  const text = section(note(folder), COMMAND_HEADING);
  const fromBlock = /```(?:bash|sh)?\n([^\n]+)/.exec(text)?.[1];
  const fromInlineCode = /`([^`]+)`/.exec(text)?.[1];
  return (fromBlock ?? fromInlineCode ?? "").trim();
}

function namesOnlyWorldEnv(folder: string): boolean {
  const env = worldEnv();
  const answer = section(note(folder), SHELL_HEADING);
  const namesEnv = new RegExp(`\\b${env}\\b`, "i").test(answer);
  const withoutEnv = answer.replace(new RegExp(env, "gi"), "");
  return namesEnv && !/\bdev\b/i.test(withoutEnv);
}

const finished = join(WORLD, "finished", "overlay");

async function finishedGuardBlocks(command: string): Promise<boolean> {
  // biome-ignore-start lint/style/useNamingConvention: a PreToolUse hook reads these exact names.
  const hookInput = JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command },
    cwd: join(WORLD, "seed", "tallowmark-infra"),
  });
  // biome-ignore-end lint/style/useNamingConvention: a PreToolUse hook reads these exact names.
  const decision = await decide(finished, "Bash", hookInput);
  return decision.blocked;
}

export default [
  {
    says: "notes/first-look.md has the three headings",
    test: (folder) =>
      HEADINGS.every(
        (heading) =>
          section(note(folder), heading) !== "" || note(folder).includes(`## ${heading}`),
      ),
    tryNext: `copy the three headings from the step README into notes/first-look.md`,
  },
  {
    says: "you found which environment the shell points at",
    test: (folder) => namesOnlyWorldEnv(folder),
    tryNext:
      "read .envrc in the world repo, or run aws sts get-caller-identity there, and name the one " +
      "env",
  },
  {
    says: "you named one of the five faults on the board",
    test: (folder) => FAULTS.test(section(note(folder), FAULT_HEADING)),
    tryNext: "run bun run board and copy the name of the fault you picked",
  },
  {
    says: "the command you named is one the finished guard blocks",
    test: async (folder) => {
      const command = namedCommand(folder);
      return command !== "" && (await finishedGuardBlocks(command));
    },
    tryNext:
      "put one command in backticks under the third heading; pick one that changes or deletes " +
      "something on prod",
  },
] satisfies Rule[];
