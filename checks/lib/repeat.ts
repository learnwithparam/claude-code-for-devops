// Behaviour that depends on a model is judged over 3 fresh runs in replay mode. All three must pass.
export async function threeRuns<T>(run: (i: number) => Promise<T>, pass: (r: T) => boolean): Promise<boolean> {
  const prev = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = prev ?? "replay";
  try {
    for (let i = 0; i < 3; i++) if (!pass(await run(i))) return false;
    return true;
  } finally {
    if (prev === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = prev;
  }
}
