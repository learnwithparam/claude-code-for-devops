// bun run models: one tiny call per role on the chosen provider. Prints role, provider and pass or fail, never a key.
import { provider, type Role } from "../config/models";
import { ask } from "./lib/llm";

let p: string;
try { p = provider(); } catch (e) { console.log((e as Error).message); process.exit(1); }
console.log(`Provider: ${p}`);
let failed = 0;
for (const role of ["fast", "smart", "judge"] as Role[]) {
  try {
    const r = await ask({ role, prompt: "Reply with the single word: ready", replayKey: `models/${role}` });
    const ok = /ready/i.test(r.text);
    if (!ok) failed++;
    console.log(`  ${role.padEnd(6)} ${r.provider.padEnd(10)} ${ok ? "PASS" : "FAIL"}  tokens in ${r.inputTokens}, out ${r.outputTokens}`);
  } catch (e) {
    failed++;
    console.log(`  ${role.padEnd(6)} ${p.padEnd(10)} FAIL  ${(e as Error).message}`);
  }
}
console.log(failed ? `${failed} role(s) failed.` : `Every role answers.`);
process.exit(failed ? 1 : 0);
