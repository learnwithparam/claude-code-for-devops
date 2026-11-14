// bun checks/ladder.ts: reads ladder.toml and fails when a ladder feature has no step, a step has
// no check, or the named rule is no longer in that step's check.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findStep, ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";

const LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"];
type Feature = { level: string; name: string; step: string; rule: string };

const tomlText = await Bun.file(join(ROOT, "ladder.toml")).text();
const { feature: features } = Bun.TOML.parse(tomlText) as unknown as { feature: Feature[] };
const problems: string[] = [];

for (const level of LEVELS) {
  if (!features.some((item) => item.level === level))
    problems.push(`${level}: no feature is mapped`);
}
for (const item of features) {
  const where = `${item.level} ${item.name}`;
  if (!findStep(item.step)) {
    problems.push(`${where}: step "${item.step}" does not exist`);
    continue;
  }
  const checkFile = join(ROOT, "checks", `${item.step}.ts`);
  if (!existsSync(checkFile)) {
    problems.push(`${where}: step "${item.step}" has no check`);
    continue;
  }
  const rules = (await import(checkFile)).default as Rule[];
  if (!rules.some((rule) => rule.says.includes(item.rule))) {
    problems.push(`${where}: no rule in ${item.step} says "${item.rule}"`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log(`${problems.length} ladder problem(s).`);
  process.exit(1);
}
const count = `${features.length} features over ${LEVELS.length} levels`;
console.log(`The ladder holds: ${count}, each with a checked step.`);
