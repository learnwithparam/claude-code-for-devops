import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { decide, ensureWorld, read, section, WORLD } from "./lib";

const note = (d: string) => read(d, "notes", "first-look.md");
const H = [
  "Where my shell points",
  "The fault that worries me most",
  "A command I would never let an agent run",
];
const FAULTS =
  /drift|buyer records|chart|seat-api|probe|alert|SeatApiSlow|cost|lifecycle|autoscaler|scan|pipeline|\bCI\b|workflow/i;
// The answer comes from the world itself: the env its .envrc points the shell at.
const worldEnv = () => {
  const home = ensureWorld();
  return (
    /TALLOWMARK_ENV=(\w+)/.exec(
      readFileSync(join(home, "tallowmark-infra", ".envrc"), "utf8"),
    )?.[1] ?? "prod"
  );
};
const command = (d: string) => {
  const s = section(note(d), H[2]);
  return (/```(?:bash|sh)?\n([^\n]+)/.exec(s)?.[1] ?? /`([^`]+)`/.exec(s)?.[1] ?? "").trim();
};
const finished = join(WORLD, "finished", "overlay");

export default [
  {
    says: "notes/first-look.md has the three headings",
    test: (d) => H.every((h) => section(note(d), h) !== "" || note(d).includes(`## ${h}`)),
    tryNext: `copy the three headings from the step README into notes/first-look.md`,
  },
  {
    says: "you found which environment the shell points at",
    test: (d) =>
      new RegExp(`\\b${worldEnv()}\\b`, "i").test(section(note(d), H[0])) &&
      !/\bdev\b/i.test(section(note(d), H[0]).replace(new RegExp(worldEnv(), "gi"), "")),
    tryNext:
      "read .envrc in the world repo, or run aws sts get-caller-identity there, and name the one env",
  },
  {
    says: "you named one of the five faults on the board",
    test: (d) => FAULTS.test(section(note(d), H[1])),
    tryNext: "run bun run board and copy the name of the fault you picked",
  },
  {
    says: "the command you named is one the finished guard blocks",
    test: async (d) =>
      command(d) !== "" &&
      (
        await decide(
          finished,
          "Bash",
          JSON.stringify({
            hook_event_name: "PreToolUse",
            tool_name: "Bash",
            tool_input: { command: command(d) },
            cwd: join(WORLD, "seed", "tallowmark-infra"),
          }),
        )
      ).blocked,
    tryNext:
      "put one command in backticks under the third heading; pick one that changes or deletes something on prod",
  },
] satisfies Rule[];
