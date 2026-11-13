// The course goal. Copies kit/ into a fresh folder, as a new team would, and plays the 45
// planted tool calls into its hook. It reads only exit codes and the kit's README.
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { denies, read, runSuite, section } from "./lib";

type Score = Awaited<ReturnType<typeof runSuite>>["score"];

const kitReadme = (folder: string) => read(folder, "kit", "README.md");
const kitSettingsText = (folder: string) => read(folder, "kit", "settings.json");

// The guard log keeps the sample and wrong answers apart from yours by the folder name.
function kindOfFolder(folder: string): string {
  if (/\/wrong\//.test(folder)) return "wrong";
  if (/\/solution\/?$/.test(folder)) return "solution";
  return "yours";
}

// Install the kit in an empty folder: settings.json and hooks/ go into .claude/.
async function scoreInFreshFolder(folder: string): Promise<Score> {
  const freshRoot = mkdtempSync(join(tmpdir(), "kit-"));
  const freshRepo = join(freshRoot, kindOfFolder(folder));
  try {
    mkdirSync(join(freshRepo, ".claude"), { recursive: true });
    cpSync(join(folder, "kit", "settings.json"), join(freshRepo, ".claude", "settings.json"));
    const hooks = join(folder, "kit", "hooks");
    if (existsSync(hooks)) cpSync(hooks, join(freshRepo, ".claude", "hooks"), { recursive: true });
    const { score } = await runSuite(freshRepo, ["dangerous", "bypass", "safe"]);
    return score;
  } finally {
    rmSync(freshRoot, { recursive: true, force: true });
  }
}

const savedScores = new Map<string, Promise<Score | null>>();
function kitScore(folder: string): Promise<Score | null> {
  if (!kitSettingsText(folder)) return Promise.resolve(null);
  const saved = savedScores.get(folder);
  if (saved) return saved;
  const score = scoreInFreshFolder(folder);
  savedScores.set(folder, score);
  return score;
}

export default [
  {
    says: "kit/ holds settings.json and the hooks folder",
    test: (folder) => kitSettingsText(folder) !== "" && existsSync(join(folder, "kit", "hooks")),
    tryNext: "ask Claude Code to copy .claude/settings.json and .claude/hooks into kit/",
  },
  {
    says: "in a fresh folder the kit blocks all 30 dangerous and bypass calls",
    test: async (folder) => {
      const score = await kitScore(folder);
      return score !== null && score.dangerous[0] + score.bypass[0] === 30;
    },
    tryNext:
      "the hook file must travel with the kit; settings alone point at a hook that is not there",
  },
  {
    says: "in a fresh folder the kit allows all 15 safe calls",
    test: async (folder) => (await kitScore(folder))?.safe[0] === 15,
    tryNext: "a kit that blocks terraform plan or kubectl get is a kit people switch off",
  },
  {
    says: "in a fresh folder the kit blocks input it cannot read",
    test: async (folder) => (await kitScore(folder))?.malformed === true,
    tryNext: "keep the try and exit 2 around JSON.parse in the hook",
  },
  {
    says: "the kit keeps the deny rules and a sandbox that must start",
    test: (folder) => {
      const settings = JSON.parse(kitSettingsText(folder) || "{}");
      const sandboxOn = settings.sandbox?.enabled === true && settings.sandbox?.failIfUnavailable;
      return sandboxOn === true && denies(settings, "Bash", "terraform apply -auto-approve");
    },
    tryNext: "copy the whole settings.json from part one, sandbox block and deny rules included",
  },
  {
    says: "kit/README.md has What it blocks, What it does not block, and How to test it",
    test: (folder) => {
      const readme = kitReadme(folder);
      const headings = ["What it blocks", "What it does not block", "How to test it"];
      return headings.every((heading) => section(readme, heading) !== "");
    },
    tryNext: "ask for those three sections; a reviewer reads What it does not block first",
  },
  {
    says: "What it does not block names the script and subprocess cases",
    test: (folder) => {
      const limits = section(kitReadme(folder), "What it does not block").toLowerCase();
      const namesSubprocess = /subprocess|child process/.test(limits);
      return limits.includes("script") && namesSubprocess;
    },
    tryNext:
      "say that the hook does not see a subprocess a program starts, or a script it cannot read",
  },
  {
    says: "the kit names no path on this machine, so it works in any clone",
    test: (folder) => {
      const text = kitSettingsText(folder);
      return text !== "" && !/\/(home|Users|root)\//.test(text);
    },
    tryNext: "point the hook at $CLAUDE_PROJECT_DIR/.claude/hooks/guard-infra.ts",
  },
] satisfies Rule[];
