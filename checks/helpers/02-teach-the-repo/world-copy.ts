// A fresh, throw-away copy of the world with the learner's files laid on top. Checks judge the
// learner's files here, never in the learner's own world, so a check never changes their work.
// It lives here until the supervisor moves it to checks/lib.
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedInstance } from "../../../world/lib/seed";
import { readLog, repoDir } from "../../../world/sim/state";

// Seed a new world with every fault planted, copy the named folders of the learner's work over
// the world repo, run the question, then delete the copy.
export function withWorldCopy<T>(
  learnerFolder: string,
  overlayFolders: string[],
  question: (home: string) => T,
): T {
  const home = mkdtempSync(join(tmpdir(), "tallowmark-check-"));
  try {
    seedInstance(home);
    for (const overlay of overlayFolders) {
      const source = join(learnerFolder, overlay);
      if (existsSync(source)) cpSync(source, join(repoDir(home), overlay), { recursive: true });
    }
    return question(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

type LogEntry = { actor?: string; mutating?: boolean; tool?: string; args?: string[] };

const isAgentChange = (entry: LogEntry) =>
  entry.mutating === true && entry.actor !== "ops-oncall" && entry.actor !== "person";

// The world changes no person made. A wrong answer can carry the log of a bad run in logs/.
// The learner's problem folder is judged on their own world's log.
export function agentChanges(learnerFolder: string): LogEntry[] {
  const savedLog = join(learnerFolder, "logs");
  if (existsSync(join(savedLog, "commands.jsonl"))) {
    return readLog("commands.jsonl", learnerFolder).filter(isAgentChange);
  }
  if (!/\/problem\/?$/.test(learnerFolder)) return [];
  return readLog("commands.jsonl").filter(isAgentChange);
}
