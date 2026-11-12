// bun run shots: recapture every picture in the course from the real system.
// Pages are screenshotted in Chromium. Terminal output is rendered as a dark terminal page, then screenshotted.
import { chromium } from "playwright";
import { join, relative } from "node:path";
import { mkdirSync } from "node:fs";
import { ROOT, allSteps } from "../scripts/structure";

const run = (cmd: string[], env: Record<string, string> = {}) => {
  const p = Bun.spawnSync(cmd, { cwd: ROOT, env: { ...process.env, CLAUDE_REPLAY: "1", ...env } });
  return (p.stdout.toString() + p.stderr.toString()).replace(/\x1b\[[0-9;]*m/g, "");
};
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const color = (l: string) =>
  /^\s*(PASS|GREEN|Done\.|Everything)/.test(l) ? `<span style="color:#7ee787">${esc(l)}</span>`
  : /^\s*(FAIL|RED|BLOCKED)/.test(l) ? `<span style="color:#ff7b72">${esc(l)}</span>`
  : /^\s*Try next/.test(l) ? `<span style="color:#e3b341">${esc(l)}</span>` : esc(l);
const terminal = (cmd: string, output: string) => `<!doctype html><html><body style="margin:0;background:#0d1117">
<div id="t" style="width:800px;box-sizing:border-box;padding:18px 20px;background:#0d1117;color:#c9d1d9;font:13px/1.5 'DejaVu Sans Mono',Menlo,monospace;white-space:pre-wrap">
<div style="color:#8b949e;margin-bottom:6px">$ ${esc(cmd)}</div>${output.trimEnd().split("\n").map(color).join("\n")}</div></body></html>`;

// CHROMIUM_PATH points at a browser installed outside Playwright, for example in a container.
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 840, height: 600 }, deviceScaleFactor: 2 });
const shotTerminal = async (cmd: string, output: string, out: string) => {
  mkdirSync(join(out, ".."), { recursive: true });
  await page.setContent(terminal(cmd, output));
  await page.locator("#t").screenshot({ path: out });
  console.log(`wrote ${relative(ROOT, out)}`);
};
const shotPage = async (file: string, out: string) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(`file://${file}`);
  await page.screenshot({ path: out, fullPage: true });
  await page.setViewportSize({ width: 840, height: 600 });
  console.log(`wrote ${relative(ROOT, out)}`);
};

// The finished system's board, as a page.
run(["bun", "run", "finished", "--html"]);
await shotPage(join(ROOT, "world", ".finished", "board.html"), join(ROOT, "images", "finished-system.png"));

// A fresh world's board, as a page and in the terminal.
run(["bun", "run", "world", "reset"]);
run(["bun", "run", "board", "--html"]);
await shotPage(join(ROOT, "world", "live", "board.html"), join(ROOT, "00-orientation", "images", "first-run.png"));

for (const s of allSteps()) {
  if (!s.meta.screen) continue;
  const out = join(s.dir, "images", "expected.png");
  if (s.name === "meet-the-world") await shotTerminal("bun run board", run(["bun", "run", "board"]), out);
  else await shotTerminal(`bun run verify ${s.name}`, run(["bun", "scripts/verify.ts", s.name, "solution"]), out);
}
await browser.close();
