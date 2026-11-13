// Did anything other than a person change the world? A check asks this to prove that Claude Code
// only read. The answer comes from the world's own command log, never from what Claude Code said.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ensureWorld, readLog } from "../../../checks/lib";

type LogEntry = { tool?: string; args?: string[]; mutating?: boolean; actor?: string };

const PEOPLE = ["ops-oncall", "person"];

function readSavedLog(path: string): LogEntry[] {
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

// A wrong answer can carry the log of the bad run in logs/commands.jsonl.
// The learner's own problem/ folder is judged on the live world's log.
// A sample answer with no log of its own changed nothing.
function logFor(folder: string): LogEntry[] {
  const savedLog = join(folder, "logs", "commands.jsonl");
  if (existsSync(savedLog)) return readSavedLog(savedLog);
  if (basename(folder) !== "problem") return [];
  ensureWorld();
  return readLog("commands.jsonl");
}

export function agentWrites(folder: string): LogEntry[] {
  const changes = logFor(folder).filter((entry) => entry.mutating);
  return changes.filter((entry) => !PEOPLE.includes(entry.actor ?? ""));
}

export const describeEntry = (entry: LogEntry) =>
  `${entry.actor} ran ${entry.tool} ${(entry.args ?? []).join(" ")}`;
