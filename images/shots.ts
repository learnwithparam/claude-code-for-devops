// bun run shots: recapture every picture in the course from the real system.
// Pages are screenshotted in Chromium. Terminal output is rendered as a dark terminal page,
// then screenshotted.

import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium } from "playwright";
import { allSteps, ROOT } from "../scripts/structure";

// Runs a command on recorded Claude Code runs and returns its output without terminal colours.
const run = (command: string[], env: Record<string, string> = {}) => {
  // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
  const fullEnv = { ...process.env, CLAUDE_REPLAY: "1", ...env };
  const commandRun = Bun.spawnSync(command, { cwd: ROOT, env: fullEnv });
  const output = commandRun.stdout.toString() + commandRun.stderr.toString();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: this matches terminal colour codes.
  return output.replace(/\x1b\[[0-9;]*m/g, "");
};

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escapeHtml = (text: string) =>
  text.replace(/[&<>]/g, (character) => HTML_ESCAPES[character] ?? character);

const coloured = (colour: string, line: string) =>
  `<span style="color:${colour}">${escapeHtml(line)}</span>`;

// Green for passing lines, red for failing ones, yellow for the next thing to try.
function colourLine(line: string): string {
  if (/^\s*(PASS|GREEN|Done\.|Everything)/.test(line)) return coloured("#7ee787", line);
  if (/^\s*(FAIL|RED|BLOCKED)/.test(line)) return coloured("#ff7b72", line);
  if (/^\s*Try next/.test(line)) return coloured("#e3b341", line);
  return escapeHtml(line);
}

const TERMINAL_STYLE = [
  "width:800px;box-sizing:border-box;padding:18px 20px;background:#0d1117;color:#c9d1d9;",
  "font:13px/1.5 'DejaVu Sans Mono',Menlo,monospace;white-space:pre-wrap",
].join("");

function terminal(command: string, output: string): string {
  const outputLines = output.trimEnd().split("\n");
  const colouredOutput = outputLines.map(colourLine).join("\n");
  const prompt = `<div style="color:#8b949e;margin-bottom:6px">$ ${escapeHtml(command)}</div>`;
  return [
    '<!doctype html><html><body style="margin:0;background:#0d1117">',
    `<div id="t" style="${TERMINAL_STYLE}">`,
    `${prompt}${colouredOutput}</div></body></html>`,
  ].join("\n");
}

// CHROMIUM_PATH points at a browser installed outside Playwright, for example in a container.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 840, height: 600 }, deviceScaleFactor: 2 });
const shotTerminal = async (command: string, output: string, imageFile: string) => {
  mkdirSync(join(imageFile, ".."), { recursive: true });
  await page.setContent(terminal(command, output));
  await page.locator("#t").screenshot({ path: imageFile });
  console.log(`wrote ${relative(ROOT, imageFile)}`);
};
const shotPage = async (file: string, imageFile: string) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(`file://${file}`);
  await page.screenshot({ path: imageFile, fullPage: true });
  await page.setViewportSize({ width: 840, height: 600 });
  console.log(`wrote ${relative(ROOT, imageFile)}`);
};

// The finished system's board, as a page.
run(["bun", "run", "finished", "--html"]);
await shotPage(
  join(ROOT, "world", ".finished", "board.html"),
  join(ROOT, "images", "finished-system.png"),
);

// A fresh world's board, as a page and in the terminal.
run(["bun", "run", "world", "reset"]);
run(["bun", "run", "board", "--html"]);
await shotPage(
  join(ROOT, "world", "live", "board.html"),
  join(ROOT, "00-orientation", "images", "first-run.png"),
);

for (const step of allSteps()) {
  if (!step.meta.screen) continue;
  const imageFile = join(step.dir, "images", "expected.png");
  if (step.name === "meet-the-world")
    await shotTerminal("bun run board", run(["bun", "run", "board"]), imageFile);
  else
    await shotTerminal(
      `bun run verify ${step.name}`,
      run(["bun", "scripts/verify.ts", step.name, "solution"]),
      imageFile,
    );
}
await browser.close();
