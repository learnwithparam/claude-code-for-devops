// Behaviour that varies from run to run (did Claude Code make the right file, give the right verdict) is judged
// over 3 recorded runs of the real `claude -p`. All three must pass. `run(i)` is handed the run number (1 to 3);
// CLAUDE_RUN tells a learner's command which recording to replay, and CLAUDE_REPLAY=1 keeps a check from going live.
import { RUNS } from "../../config/claude";

export async function threeRuns<T>(run: (i: number) => Promise<T>, pass: (r: T) => boolean): Promise<boolean> {
  const prev = { run: process.env.CLAUDE_RUN, replay: process.env.CLAUDE_REPLAY };
  process.env.CLAUDE_REPLAY = "1";
  try {
    for (let i = 1; i <= RUNS; i++) {
      process.env.CLAUDE_RUN = String(i);
      if (!pass(await run(i))) return false;
    }
    return true;
  } finally {
    for (const [k, v] of [["CLAUDE_RUN", prev.run], ["CLAUDE_REPLAY", prev.replay]] as const)
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
  }
}
