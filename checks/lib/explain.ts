// Extra lines under a FAIL, printed only when a learner checks that one step, and only once.
const askedStep = process.argv[2];
const printedLines = new Set<string>();
const MOST_LINES_SHOWN = 6;

export const explain = (step: string, lines: string[]) => {
  if (askedStep !== step) return;
  for (const line of lines.slice(0, MOST_LINES_SHOWN)) {
    if (printedLines.has(line)) continue;
    printedLines.add(line);
    console.log(`        ${line}`);
  }
};
