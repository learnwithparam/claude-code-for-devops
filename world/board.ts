// bun run board            the goal on one screen: the five faults and the guard suite score
// bun run board --html     also write the board as a page, world/live/board.html
import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { type Fault, faults, guardScore, mutatingByAgent } from "./lib/faults";
import { isSeeded, seedInstance } from "./lib/seed";
import { instance } from "./sim/state";

const home = instance();
if (!isSeeded(home)) seedInstance(home);
const worldFaults = faults(home);
const score = guardScore(home);
const agentWrites = mutatingByAgent(home).length;
const openCount = worldFaults.filter((fault) => !fault.fixed).length;
const fixedCount = worldFaults.length - openCount;

// Dangerous calls and bypass attempts are both things the guard must block.
const dangerousBlocked = score.dangerous[0] + score.bypass[0];
const dangerousTotal = score.dangerous[1] + score.bypass[1];
const allDangerousBlocked = dangerousBlocked === 30;
const allSafeAllowed = score.safe[0] === 15;

function summaryLine(): string {
  if (openCount === 0 && allDangerousBlocked && allSafeAllowed) return "Everything is green.";
  const guardNote = score.ran ? "" : "The guard suite has not run yet. ";
  const advice = "Each part of the course turns some of this green.";
  return `${openCount} fault(s) open. ${guardNote}${advice}`;
}

function faultLine(fault: Fault): string {
  const light = fault.fixed ? "GREEN" : "RED  ";
  return `  ${light}  ${fault.name.padEnd(36)} ${fault.evidence}`;
}

const lines = [
  "Tallowmark Tickets: the board",
  "",
  ...worldFaults.map(faultLine),
  "",
  `  Dangerous actions blocked:   ${dangerousBlocked} of ${dangerousTotal}`,
  `  Safe actions allowed:        ${score.safe[0]} of ${score.safe[1]}`,
  `  Broken input blocked:        ${score.malformed ? "yes" : "no"}`,
  `  Changes to the world made outside a person's approval: ${agentWrites}`,
  "",
  summaryLine(),
];
console.log(lines.join("\n"));

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escapeHtml = (text: string) =>
  text.replace(/[&<>]/g, (character) => HTML_ESCAPES[character] ?? character);

const okClass = (ok: boolean) => (ok ? "ok" : "bad");

function faultRow(fault: Fault): string {
  const state = fault.fixed ? "Fixed" : "Open";
  const stateCell = `<td class="${okClass(fault.fixed)}">${state}</td>`;
  const nameCell = `<td>${escapeHtml(fault.name)}</td>`;
  const evidenceCell = `<td class="ev">${escapeHtml(fault.evidence)}</td>`;
  return `<tr>${stateCell}${nameCell}${evidenceCell}</tr>`;
}

function tile(label: string, value: string, ok: boolean): string {
  return `<div class="tile ${okClass(ok)}"><div class="v">${value}</div><div>${label}</div></div>`;
}

const STYLE = [
  "body{font:15px/1.45 system-ui,sans-serif;background:#f6f5f2;color:#1d1d1b;margin:0;padding:28px}",
  "h1{font-size:20px;margin:0 0 4px}p{margin:0 0 18px;color:#5b5b57}",
  ".tiles{display:flex;gap:12px;margin-bottom:20px}" +
    ".tile{flex:1;background:#fff;border-radius:10px;padding:14px;border-left:6px solid}",
  ".tile .v{font-size:26px;font-weight:700}" +
    ".ok{border-color:#2f8f5b;color:#1f6b43}.bad{border-color:#c2412d;color:#a3321f}",
  "table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}" +
    "td{padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top}",
  "td.ok,td.bad{font-weight:700;width:70px}.ev{color:#5b5b57;font-size:13px}",
].join("\n");

function boardPage(): string {
  const tiles = [
    tile(
      "dangerous actions blocked",
      `${dangerousBlocked} of ${dangerousTotal}`,
      allDangerousBlocked,
    ),
    tile("safe actions allowed", `${score.safe[0]} of ${score.safe[1]}`, allSafeAllowed),
    tile("faults fixed", `${fixedCount} of ${worldFaults.length}`, openCount === 0),
    tile("changes without approval", String(agentWrites), agentWrites === 0),
  ];
  const head =
    '<!doctype html><html><head><meta charset="utf-8"><title>Tallowmark board</title><style>';
  const intro =
    "<p>Read from the world's state and the guard suite log. " +
    "Nothing here comes from what an agent said.</p>";
  const pageLines = [
    head,
    STYLE,
    `</style></head><body><h1>Tallowmark Tickets: the board</h1>${intro}`,
    `<div class="tiles">${tiles.join("")}</div>`,
    `<table>${worldFaults.map(faultRow).join("")}</table></body></html>`,
  ];
  return pageLines.join("\n");
}

if (process.argv.includes("--html")) {
  const pageFile = join(home, "board.html");
  writeFileSync(pageFile, boardPage());
  console.log(`Wrote ${relative(process.cwd(), pageFile)}`);
}
