// Reads one Terraform plan as JSON and prints a verdict as one JSON object:
// {"verdict": "approve"|"block"|"needs-human",
//  "destroys": [...], "replaces": [...], "reasons": [...]}
// The lists come from the plan itself.
// Claude Code, run headless with `claude -p`, writes the verdict and reasons.
// But it can never approve a plan that destroys or replaces something:
// code blocks those before it is asked.
// With no signed-in Claude Code, or in CI, it replays a recorded `claude -p` run for this plan.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PLAN_REVIEW } from "../../../../config/claude";
import { mode, runClaude } from "../../../lib/claude";

type ResourceChange = {
  address: string;
  type: string;
  change: { actions: string[] };
};
type ClaudeAnswer = { verdict?: string; reasons?: string[] };

const VERDICTS = ["approve", "block", "needs-human"];

const planFile = process.argv[process.argv.length - 1];
const plan = JSON.parse(readFileSync(planFile, "utf8"));
const changes: ResourceChange[] = plan.resource_changes ?? [];

function isDestroy(resource: ResourceChange): boolean {
  const actions = resource.change.actions;
  return actions.length === 1 && actions[0] === "delete";
}

// Terraform replaces a resource by deleting it and creating it again.
function isReplace(resource: ResourceChange): boolean {
  const actions = resource.change.actions;
  return actions.includes("delete") && actions.includes("create");
}

// One line per change, such as "create module.scan_store.aws_s3_bucket.scan".
function summarize(resources: ResourceChange[]): string {
  const realChanges = resources.filter((resource) => !resource.change.actions.includes("no-op"));
  const lines = realChanges.map(
    (resource) => `${resource.change.actions.join("+")} ${resource.address}`,
  );
  return lines.join("\n");
}

// Use Claude Code's verdict only when it is one of the three we know.
function chooseVerdict(answer: ClaudeAnswer | undefined): string {
  const verdict = answer?.verdict ?? "";
  if (VERDICTS.includes(verdict)) {
    return verdict;
  }
  return "needs-human";
}

function chooseReasons(answer: ClaudeAnswer | undefined): string[] {
  if (answer?.reasons?.length) {
    return answer.reasons;
  }
  return ["Claude Code returned no verdict, so a person decides"];
}

const destroys = changes.filter(isDestroy).map((resource) => resource.address);
const replaces = changes.filter(isReplace).map((resource) => resource.address);

const prompt = [
  "You review one Terraform plan for a ticketing platform's infra repo. Do not run anything.",
  "Block any IAM policy with a wildcard action or resource. " +
    "Send any change to a database to a human.",
  "Approve a plan that only adds or tags resources " +
    "and touches no database, IAM or buyer records.",
  "A lifecycle rule that expires old telemetry or scan readings " +
    "is routine housekeeping: approve it.",
  `Plan summary:\n${summarize(changes)}`,
  `Full resource changes:\n${JSON.stringify(changes)}`,
].join("\n\n");

const runNumber = process.env.CLAUDE_RUN ?? "1";
const run = runClaude({
  name: `plan-review/${basename(planFile, ".json")}/run-${runNumber}`,
  cwd: process.cwd(),
  prompt,
  args: [...PLAN_REVIEW.args, "--json-schema", JSON.stringify(PLAN_REVIEW.schema)],
  live: mode().mode === "live",
});
const answer = run.result?.structured_output as ClaudeAnswer | undefined;
let verdict = chooseVerdict(answer);
let reasons = chooseReasons(answer);

// This rule is code, not a request to Claude, so no answer can get past it.
const destroyedOrReplaced = [...destroys, ...replaces];
if (destroyedOrReplaced.length > 0) {
  verdict = "block";
  reasons = [`the plan destroys or replaces ${destroyedOrReplaced.join(", ")}`, ...reasons];
}
console.log(JSON.stringify({ verdict, destroys, replaces, reasons }));
