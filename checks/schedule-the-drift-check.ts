// Reads routines/drift-check.toml. It schedules nothing and runs no plan.
import type { Rule } from "../scripts/verify";
import { read } from "./lib";

type Routine = {
  cron?: string;
  prompt?: string;
  // biome-ignore lint/style/useNamingConvention: the routine file uses snake case.
  allowed_tools?: string[];
  // biome-ignore lint/style/useNamingConvention: the routine file uses snake case.
  notify_when?: string;
  owner?: string;
  // biome-ignore lint/style/useNamingConvention: the routine file uses snake case.
  contract?: { max_turns?: number; on_failure?: string; log?: string };
};
const CHANGES = /\b(apply|destroy|import|taint|state (rm|mv))\b/i;

function routine(folder: string): Routine {
  try {
    return Bun.TOML.parse(read(folder, "routines", "drift-check.toml")) as Routine;
  } catch {
    return {};
  }
}

export default [
  {
    says: "the schedule is five cron fields",
    test: (folder) => (routine(folder).cron ?? "").trim().split(/\s+/).length === 5,
    tryNext: "write cron as minute hour day month weekday, such as 0 7 * * 1-5",
  },
  {
    says: "the schedule runs at most once an hour",
    test: (folder) => {
      const [minute, hour] = (routine(folder).cron ?? "").trim().split(/\s+/);
      return (
        /^\d+$/.test(minute ?? "") && hour !== undefined && hour !== "*" && !hour.startsWith("*/")
      );
    },
    tryNext: "use a fixed minute and a fixed hour; a check every minute is noise",
  },
  {
    says: "the prompt plans prod with -detailed-exitcode",
    test: (folder) => {
      const prompt = routine(folder).prompt ?? "";
      return (
        /terraform plan/.test(prompt) && /-detailed-exitcode/.test(prompt) && /prod/.test(prompt)
      );
    },
    tryNext: "ask for terraform plan -detailed-exitcode on prod; exit code 2 means drift",
  },
  {
    says: "the prompt says never to apply, and a person applies",
    test: (folder) => {
      const prompt = routine(folder).prompt ?? "";
      return /never (run )?apply/i.test(prompt) && /\b(person|human|engineer)\b/i.test(prompt);
    },
    tryNext: "add: Never run apply. A person applies, after reading your note",
  },
  {
    says: "no allowed tool changes anything",
    test: (folder) => {
      const tools = routine(folder).allowed_tools ?? [];
      return tools.length > 0 && !tools.some((tool) => CHANGES.test(tool));
    },
    tryNext: "allow only terraform plan, terraform show, Read and writes to reviews/",
  },
  {
    says: "it notifies only on drift, and names an owner",
    test: (folder) => {
      const found = routine(folder);
      return found.notify_when === "drift" && (found.owner ?? "").trim().length > 3;
    },
    tryNext: 'set notify_when to "drift" and name the person or team who reads it',
  },
  {
    says: "the run contract caps turns, says what a failed run does, and keeps a log",
    test: (folder) => {
      const contract = routine(folder).contract ?? {};
      const turns = Number(contract.max_turns);
      const failure = (contract.on_failure ?? "").trim().length > 3;
      return turns > 0 && turns <= 30 && failure && (contract.log ?? "").endsWith(".jsonl");
    },
    tryNext: "add a contract table: max_turns, on_failure and a log file that ends in .jsonl",
  },
] satisfies Rule[];
