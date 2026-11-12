// Extra lines under a FAIL, only when a learner checks one step. Quiet during bun run check.
const quiet = process.argv.some((a) => a === "--all" || a === "--report" || a === "part");
export const explain = (lines: string[]) => { if (!quiet) for (const l of lines.slice(0, 6)) console.log(`        ${l}`); };
