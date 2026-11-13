// Runs the learner's plan review command on the 6 saved plans, on each of the 3 recorded
// `claude -p` runs, and compares every answer with the answer key. It reads only what the
// command prints: one JSON object per plan.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { explain, threeRuns, WORLD } from "./lib";

const STEP = "review-the-plan-headless";
const PLANS_FOLDER = join(WORLD, "seed", "tallowmark-infra", "plans");
const ANSWERS_FILE = join(WORLD, "guard", "plan-answers.json");
const SECONDS_PER_REVIEW = 60;

type Answer = { verdict: string; destroys: string[]; replaces: string[] };
type Review = {
  plan: string;
  runNumber: number;
  verdict?: unknown;
  destroys?: unknown;
  replaces?: unknown;
  reasons?: unknown;
  problem?: string;
};

const answerKey = (): Record<string, Answer> => JSON.parse(readFileSync(ANSWERS_FILE, "utf8"));

// The command in review.config.json, or "" when the file is missing or broken.
export function reviewCommand(folder: string): string {
  const configFile = join(folder, "review.config.json");
  if (!existsSync(configFile)) return "";
  try {
    const config = JSON.parse(readFileSync(configFile, "utf8"));
    return typeof config.command === "string" ? config.command : "";
  } catch {
    return "";
  }
}

// Run the command once on one plan, with the plan's path as the last argument.
export function reviewOnePlan(folder: string, planFile: string, extraEnv = {}): Review {
  const plan =
    planFile
      .split("/")
      .pop()
      ?.replace(/\.json$/, "") ?? planFile;
  const runNumber = Number(process.env.CLAUDE_RUN ?? "1");
  const command = `${reviewCommand(folder)} "${planFile}"`;
  const review = Bun.spawnSync(["sh", "-c", command], {
    cwd: folder,
    env: { ...process.env, ...extraEnv },
    timeout: SECONDS_PER_REVIEW * 1000,
  });
  const printed = review.stdout.toString().trim();
  try {
    return { plan, runNumber, ...JSON.parse(printed) };
  } catch {
    const lastError = review.stderr.toString().trim().split("\n").pop();
    const problem = printed ? "it printed text, not one JSON object" : `no output (${lastError})`;
    return { plan, runNumber, problem };
  }
}

async function reviewEveryPlan(folder: string): Promise<Review[]> {
  const planNames = Object.keys(answerKey());
  const reviews: Review[] = [];
  await threeRuns(
    async () => {
      for (const plan of planNames) {
        reviews.push(reviewOnePlan(folder, join(PLANS_FOLDER, `${plan}.json`)));
      }
      return true;
    },
    () => true,
  );
  return reviews;
}

// Run the reviews once per folder, so the rules below share them.
const savedReviews = new Map<string, Promise<Review[]>>();
function reviews(folder: string): Promise<Review[]> {
  if (!reviewCommand(folder)) return Promise.resolve([]);
  const saved = savedReviews.get(folder);
  if (saved) return saved;
  const run = reviewEveryPlan(folder);
  savedReviews.set(folder, run);
  return run;
}

const isTextList = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function hasContractShape(review: Review): boolean {
  if (review.problem) return false;
  const lists = [review.destroys, review.replaces, review.reasons];
  return typeof review.verdict === "string" && lists.every(isTextList);
}

const sortedText = (addresses: unknown) => [...(addresses as string[])].sort().join(", ");

function listsMatch(review: Review): boolean {
  const want = answerKey()[review.plan];
  if (!hasContractShape(review)) return false;
  const sameDestroys = sortedText(review.destroys) === sortedText(want.destroys);
  return sameDestroys && sortedText(review.replaces) === sortedText(want.replaces);
}

const verdictMatches = (review: Review) => review.verdict === answerKey()[review.plan].verdict;

// True when every review passes. Each failing plan and run is printed under the FAIL.
async function everyReview(folder: string, passes: (review: Review) => boolean) {
  const allReviews = await reviews(folder);
  const failing = allReviews.filter((review) => !passes(review));
  const lines = failing.map((review) => {
    const what = review.problem ?? `verdict ${String(review.verdict)}`;
    return `${review.plan}, run ${review.runNumber}: ${what}`;
  });
  explain(STEP, lines);
  return allReviews.length > 0 && failing.length === 0;
}

const holdsData = (plan: string) => {
  const want = answerKey()[plan];
  return want.destroys.length + want.replaces.length > 0;
};

export default [
  {
    says: "review.config.json names the command that reviews a plan",
    test: (folder) => reviewCommand(folder) !== "",
    tryNext:
      'ask Claude Code for review.config.json with { "command": "bun review/plan-review.ts" }',
  },
  {
    says: "the review command never applies or destroys anything",
    test: (folder) => {
      const command = reviewCommand(folder);
      return command !== "" && !/\b(apply|destroy)\b/.test(command);
    },
    tryNext: "the review only reads the plan JSON; a person applies after a person approves",
  },
  {
    says: "on every plan it prints one JSON object: verdict, destroys, replaces, reasons",
    test: (folder) => everyReview(folder, hasContractShape),
    tryNext: "print only JSON.stringify({ verdict, destroys, replaces, reasons }) and nothing else",
  },
  {
    says: "destroys and replaces match the plan exactly on all 6 plans",
    test: (folder) => everyReview(folder, listsMatch),
    tryNext:
      "a destroy has the one action delete; a replace has delete and create; " +
      "work these out in code from resource_changes",
  },
  {
    says: "every plan that destroys or replaces data is blocked, on all 3 recorded runs",
    test: (folder) =>
      everyReview(folder, (review) => !holdsData(review.plan) || review.verdict === "block"),
    tryNext:
      "Claude Code said needs-human on the orders database; " +
      "force block in code when destroys or replaces is not empty",
  },
  {
    says: "the verdict matches the answer key on all 6 plans, on all 3 recorded runs",
    test: (folder) => everyReview(folder, verdictMatches),
    tryNext: "keep the prompt from the step README; it tells Claude Code which plans to approve",
  },
] satisfies Rule[];
