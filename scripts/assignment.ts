// Part of `bun run check`: the assignment check must pass on the reference solution, fail on the
// untouched starter, and fail again when one line of the solution is broken.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gradeAssignment } from "../checks/assignment";
import { ROOT } from "./structure";

const SOLUTION = join(
  ROOT,
  "parts/05-check-infrastructure-rules-with-conftest/01-write-the-plan-policy/solution",
);
const STARTER = join(ROOT, "assignment", "starter");
const problems: string[] = [];

function expectOutcome(name: string, passed: boolean, wanted: boolean) {
  const outcome = passed ? "passes" : "fails";
  console.log(`  ${name}: the check ${outcome}${passed === wanted ? "" : "  <-- not wanted"}`);
  if (passed !== wanted) problems.push(`${name} ${outcome}`);
}

async function brokenSolution() {
  const copy = mkdtempSync(join(tmpdir(), "assignment-broken-"));
  cpSync(SOLUTION, copy, { recursive: true });
  const policyFile = join(copy, "policy", "plan.rego");
  const policy = readFileSync(policyFile, "utf8");
  const broken = policy.replace('"delete" in', '"nothing" in');
  writeFileSync(policyFile, broken);
  const grade = await gradeAssignment(copy);
  rmSync(copy, { recursive: true, force: true });
  return grade;
}

expectOutcome("reference solution", (await gradeAssignment(SOLUTION)).passed, true);
expectOutcome("untouched starter", (await gradeAssignment(STARTER)).passed, false);
expectOutcome("solution with one line broken", (await brokenSolution()).passed, false);

if (problems.length > 0) {
  console.log(`The assignment proof failed: ${problems.join("; ")}.`);
  process.exit(1);
}
console.log("The check passes on the solution and fails on the starter and a broken solution.");
