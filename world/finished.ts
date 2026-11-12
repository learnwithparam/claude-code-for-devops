// bun run finished: build the finished system next to yours and prove it, with no model key.
// 1. Seed world/.finished from the same world, with the course's sample answers in place.
// 2. Play the 45 planted tool calls into its guard hook.
// 3. Run its plan review on the 6 saved plans, in replay mode, and compare with the answer key.
// 4. Show its board.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WORLD, repoDir } from "./sim/state";
import { seedInstance } from "./lib/seed";

const home = join(WORLD, ".finished");
process.env.TALLOWMARK_HOME = home;
process.env.LLM_PROVIDER ??= "replay";
seedInstance(home, join(WORLD, "finished", "overlay"));
const repo = repoDir(home);
console.log(`Built the finished system in world/.finished.`);

const { runSuite } = await import("../checks/lib/guard");
const { score } = await runSuite(repo, ["dangerous", "bypass", "safe"]);
console.log(`Guard suite: blocked ${score.dangerous[0] + score.bypass[0]} of ${score.dangerous[1] + score.bypass[1]} dangerous calls, allowed ${score.safe[0]} of ${score.safe[1]} safe calls, broken input ${score.malformed ? "blocked" : "ALLOWED"}.`);

const answers = JSON.parse(readFileSync(join(WORLD, "guard", "plan-answers.json"), "utf8"));
const { command } = JSON.parse(readFileSync(join(repo, "review.config.json"), "utf8"));
let right = 0;
for (const [name, want] of Object.entries<any>(answers)) {
  const planFile = join(repo, "plans", `${name}.json`);
  const p = Bun.spawnSync(["sh", "-c", `${command} "${planFile}"`], { cwd: repo, env: process.env });
  let got: any = {};
  try { got = JSON.parse(p.stdout.toString()); } catch {}
  const same = (a: string[] = [], b: string[] = []) => [...a].sort().join() === [...b].sort().join();
  const ok = got.verdict === want.verdict && same(got.destroys, want.destroys) && same(got.replaces, want.replaces);
  if (ok) right++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} ${got.verdict ?? "no answer"}${ok ? "" : ` (want ${want.verdict})`}`);
}
console.log(`Plan review: ${right} of ${Object.keys(answers).length} saved plans judged right.`);
console.log("");
const b = Bun.spawnSync(["bun", join(WORLD, "board.ts"), ...process.argv.slice(2)], { env: process.env });
process.stdout.write(b.stdout.toString());
process.exit(right === Object.keys(answers).length && score.safe[0] === score.safe[1] ? 0 : 1);
