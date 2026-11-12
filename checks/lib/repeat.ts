// Behaviour that varies from run to run (did Claude Code make the right file, give the right
// verdict) is judged over 3 recorded runs of the real `claude -p`. All three must pass.
// `run(i)` is handed the run number (1 to 3). CLAUDE_RUN tells a learner's command which recording to replay, and
// CLAUDE_REPLAY=1 keeps a check from going live.
import { RUNS } from "../../config/claude";

// Put an environment variable back the way it was before the runs.
function restore(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

export async function threeRuns<T>(
  run: (runNumber: number) => Promise<T>,
  pass: (result: T) => boolean,
): Promise<boolean> {
  const previousRun = process.env.CLAUDE_RUN;
  const previousReplay = process.env.CLAUDE_REPLAY;
  process.env.CLAUDE_REPLAY = "1";
  try {
    for (let i = 1; i <= RUNS; i++) {
      process.env.CLAUDE_RUN = String(i);
      if (!pass(await run(i))) return false;
    }
    return true;
  } finally {
    restore("CLAUDE_RUN", previousRun);
    restore("CLAUDE_REPLAY", previousReplay);
  }
}
