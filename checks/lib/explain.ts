// Extra lines under a FAIL, printed only when a learner checks that one step, and only once.
const asked = process.argv[2];
const printed = new Set<string>();
export const explain = (step: string, lines: string[]) => {
  if (asked !== step) return;
  for (const l of lines.slice(0, 6)) {
    if (printed.has(l)) continue;
    printed.add(l);
    console.log(`        ${l}`);
  }
};
