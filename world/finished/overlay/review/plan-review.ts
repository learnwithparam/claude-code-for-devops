// Reads one Terraform plan as JSON and prints a verdict as one JSON object:
// {"verdict": "approve"|"block"|"needs-human", "destroys": [...], "replaces": [...], "reasons": [...]}
// The lists come from the plan itself. The model writes the verdict and reasons, but it can never approve a
// plan that destroys or replaces something: those are blocked by code, before the model is asked.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { ask } from "../../../lib/llm";

const file = process.argv.at(-1)!;
const plan = JSON.parse(readFileSync(file, "utf8"));
const changes = (plan.resource_changes ?? []) as { address: string; type: string; change: { actions: string[] } }[];
const destroys = changes.filter((c) => c.change.actions.length === 1 && c.change.actions[0] === "delete").map((c) => c.address);
const replaces = changes.filter((c) => c.change.actions.includes("delete") && c.change.actions.includes("create")).map((c) => c.address);

const summary = changes.filter((c) => !c.change.actions.includes("no-op")).map((c) => `${c.change.actions.join("+")} ${c.address}`).join("\n");
const reply = await ask({
  role: "smart",
  system: "You review Terraform plans for a ticketing platform. Answer with JSON only: {\"verdict\": \"approve\"|\"block\"|\"needs-human\", \"reasons\": [\"one sentence\"]}. Block any IAM policy with a wildcard action. Send any change to a database to a human.",
  prompt: `Plan:\n${summary}\n\nFull plan JSON:\n${JSON.stringify(changes)}`,
  replayKey: `plan-review/${basename(file, ".json")}`,
});
let model: { verdict: string; reasons: string[] };
try { model = JSON.parse(reply.text.replace(/^```json\s*|```$/g, "")); } catch { model = { verdict: "needs-human", reasons: ["the reviewer's answer was not JSON"] }; }
const hard = destroys.length || replaces.length;
console.log(JSON.stringify({
  verdict: hard ? "block" : ["approve", "block", "needs-human"].includes(model.verdict) ? model.verdict : "needs-human",
  destroys,
  replaces,
  reasons: hard ? [`the plan destroys or replaces ${[...destroys, ...replaces].join(", ")}`, ...model.reasons] : model.reasons,
}));
