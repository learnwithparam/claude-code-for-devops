// bun run board            the goal on one screen: the five faults and the guard suite score
// bun run board --html     also write the board as a page, world/live/board.html
import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { instance } from "./sim/state";
import { isSeeded, seedInstance } from "./lib/seed";
import { faults, guardScore, mutatingByAgent } from "./lib/faults";

const home = instance();
if (!isSeeded(home)) seedInstance(home);
const fs = faults(home);
const g = guardScore(home);
const agentWrites = mutatingByAgent(home).length;
const open = fs.filter((f) => !f.fixed).length;

const lines = [
  `Tallowmark Tickets: the board`,
  ``,
  ...fs.map((f) => `  ${f.fixed ? "GREEN" : "RED  "}  ${f.name.padEnd(36)} ${f.evidence}`),
  ``,
  `  Dangerous actions blocked:   ${g.dangerous[0] + g.bypass[0]} of ${g.dangerous[1] + g.bypass[1]}`,
  `  Safe actions allowed:        ${g.safe[0]} of ${g.safe[1]}`,
  `  Broken input blocked:        ${g.malformed ? "yes" : "no"}`,
  `  Changes to the world made outside a person's approval: ${agentWrites}`,
  ``,
  open === 0 && g.dangerous[0] + g.bypass[0] === 30 && g.safe[0] === 15
    ? `Everything is green.`
    : `${open} fault(s) open. ${g.ran ? "" : "The guard suite has not run yet. "}Each part of the course turns some of this green.`,
];
console.log(lines.join("\n"));

if (process.argv.includes("--html")) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const row = (ok: boolean, name: string, ev: string) => `<tr><td class="${ok ? "ok" : "bad"}">${ok ? "Fixed" : "Open"}</td><td>${esc(name)}</td><td class="ev">${esc(ev)}</td></tr>`;
  const tile = (label: string, v: string, ok: boolean) => `<div class="tile ${ok ? "ok" : "bad"}"><div class="v">${v}</div><div>${label}</div></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tallowmark board</title><style>
body{font:15px/1.45 system-ui,sans-serif;background:#f6f5f2;color:#1d1d1b;margin:0;padding:28px}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 18px;color:#5b5b57}
.tiles{display:flex;gap:12px;margin-bottom:20px}.tile{flex:1;background:#fff;border-radius:10px;padding:14px;border-left:6px solid}
.tile .v{font-size:26px;font-weight:700}.ok{border-color:#2f8f5b;color:#1f6b43}.bad{border-color:#c2412d;color:#a3321f}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}td{padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top}
td.ok,td.bad{font-weight:700;width:70px}.ev{color:#5b5b57;font-size:13px}
</style></head><body><h1>Tallowmark Tickets: the board</h1><p>Read from the world's state and the guard suite log. Nothing here comes from what an agent said.</p>
<div class="tiles">${tile("dangerous actions blocked", `${g.dangerous[0] + g.bypass[0]} of ${g.dangerous[1] + g.bypass[1]}`, g.dangerous[0] + g.bypass[0] === 30)}${tile("safe actions allowed", `${g.safe[0]} of ${g.safe[1]}`, g.safe[0] === 15)}${tile("faults fixed", `${fs.length - open} of ${fs.length}`, open === 0)}${tile("changes without approval", String(agentWrites), agentWrites === 0)}</div>
<table>${fs.map((f) => row(f.fixed, f.name, f.evidence)).join("")}</table></body></html>`;
  const out = join(home, "board.html");
  writeFileSync(out, html);
  console.log(`Wrote ${relative(process.cwd(), out)}`);
}
