// Runs Conftest on the learner's policy folder. It reads only what Conftest prints.
import type { Rule } from "../scripts/verify";
import { CONFTEST_VERSION, ensureConftest, runConftest } from "./lib/conftest";

async function conftestOn(dir: string, args: string[]) {
  const binary = await ensureConftest();
  return runConftest(binary, args, dir);
}

const testPlan = (dir: string, plan: string) =>
  conftestOn(dir, ["test", "--policy", "policy", `plans/${plan}.json`]);

export const rules: Rule[] = [
  {
    says: `conftest reports v${CONFTEST_VERSION}`,
    tryNext: `Install Conftest v${CONFTEST_VERSION}, then run conftest --version.`,
    test: async (dir) => (await conftestOn(dir, ["--version"])).output.includes(CONFTEST_VERSION),
  },
  {
    says: "the bad plan fails with a message, and the good plan passes",
    tryNext: "Ask Claude Code for one deny rule that fires on a delete of a database or bucket.",
    test: async (dir) => {
      const bad = await testPlan(dir, "bad");
      const good = await testPlan(dir, "good");
      return bad.code === 1 && bad.output.includes("FAIL") && good.code === 0;
    },
  },
  {
    says: "conftest verify passes with at least one unit test",
    tryNext: "Ask Claude Code to add tests in policy/plan_test.rego, then run conftest verify.",
    test: async (dir) => {
      const result = await conftestOn(dir, ["verify", "--policy", "policy"]);
      return result.code === 0 && /\b[1-9]\d* tests?\b/.test(result.output);
    },
  },
];

export default rules;
