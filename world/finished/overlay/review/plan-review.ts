// Reads one Terraform plan as JSON and prints a verdict as one JSON object:
// {"verdict": "approve"|"block"|"needs-human", "destroys": [...], "replaces": [...], "reasons": [...]}
// The lists come from the plan itself. Claude Code, run headless with `claude -p`, writes the verdict and reasons,
// but it can never approve a plan that destroys or replaces something: code blocks those before it is asked.
// With no signed-in Claude Code, or in CI, it replays a recorded `claude -p` run for this plan.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PLAN_REVIEW } from "../../../../config/claude";
import { mode, runClaude } from "../../../lib/claude";

const file = process.argv.at(-1)!;
const plan = JSON.parse(readFileSync(file, "utf8"));
const changes = (plan.resource_changes ?? []) as {
  address: string;
  type: string;
  change: { actions: string[] };
}[];
const destroys = changes
  .filter((c) => c.change.actions.length === 1 && c.change.actions[0] === "delete")
  .map((c) => c.address);
const replaces = changes
  .filter((c) => c.change.actions.includes("delete") && c.change.actions.includes("create"))
  .map((c) => c.address);
const summary = changes
  .filter((c) => !c.change.actions.includes("no-op"))
  .map((c) => `${c.change.actions.join("+")} ${c.address}`)
  .join("\n");

const prompt = [
  "You review one Terraform plan for a ticketing platform's infra repo. Do not run anything.",
  "Block any IAM policy with a wildcard action or resource. Send any change to a database to a human.",
  "Approve a plan that only adds or tags resources and touches no database, IAM or buyer records.",
  "A lifecycle rule that expires old telemetry or scan readings is routine housekeeping: approve it.",
  `Plan summary:\n${summary}`,
  `Full resource changes:\n${JSON.stringify(changes)}`,
].join("\n\n");

const run = runClaude({
  name: `plan-review/${basename(file, ".json")}/run-${process.env.CLAUDE_RUN ?? "1"}`,
  cwd: process.cwd(),
  prompt,
  args: [...PLAN_REVIEW.args, "--json-schema", JSON.stringify(PLAN_REVIEW.schema)],
  live: mode().mode === "live",
});
const said = run.result?.structured_output as { verdict?: string; reasons?: string[] } | undefined;
const verdict =
  said && ["approve", "block", "needs-human"].includes(said.verdict ?? "")
    ? said.verdict!
    : "needs-human";
const reasons = said?.reasons?.length
  ? said.reasons
  : ["Claude Code returned no verdict, so a person decides"];
const hard = destroys.length || replaces.length;
console.log(
  JSON.stringify({
    verdict: hard ? "block" : verdict,
    destroys,
    replaces,
    reasons: hard
      ? [`the plan destroys or replaces ${[...destroys, ...replaces].join(", ")}`, ...reasons]
      : reasons,
  }),
);
