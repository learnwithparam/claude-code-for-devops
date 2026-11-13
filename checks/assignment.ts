// The closing assignment check. It runs the same rules as the step on one folder and writes
// assignment/result.json: one pass or fail per Done-when line, plus the Conftest version found.
// Usage: bun checks/assignment.ts [folder]   (default: assignment/starter)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import { ensureConftest, runConftest } from "./lib/conftest";
import { rules } from "./write-the-plan-policy";

export type AssignmentResult = {
  conftest: string;
  lines: { says: string; result: "pass" | "fail" }[];
  passed: boolean;
};

export async function gradeAssignment(dir: string): Promise<AssignmentResult> {
  const binary = await ensureConftest();
  const found = runConftest(binary, ["--version"], ROOT).output.split("\n")[0].trim();
  const lines: AssignmentResult["lines"] = [];
  for (const rule of rules) {
    let passed = false;
    try {
      passed = await rule.test(dir);
    } catch {
      passed = false;
    }
    lines.push({ says: rule.says, result: passed ? "pass" : "fail" });
  }
  return { conftest: found, lines, passed: lines.every((line) => line.result === "pass") };
}

if (import.meta.main) {
  const folder = process.argv[2] ?? join(ROOT, "assignment", "starter");
  const grade = await gradeAssignment(folder);
  writeFileSync(join(ROOT, "assignment", "result.json"), `${JSON.stringify(grade, null, 2)}\n`);
  for (const line of grade.lines) console.log(`  ${line.result.toUpperCase()}  ${line.says}`);
  console.log(grade.passed ? "Assignment passes." : "Assignment does not pass yet.");
  process.exit(grade.passed ? 0 : 1);
}
