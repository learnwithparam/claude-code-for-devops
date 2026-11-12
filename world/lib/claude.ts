// The one place the course starts Claude Code. It runs the real `claude` CLI, signed in with your own Claude
// account, or replays a run recorded from it. It never calls a model API and never needs a key.
//
// Live when `claude` is installed and signed in, and this is not CI. Replay otherwise, or when CLAUDE_REPLAY=1.
// Set CLAUDE_RECORD=1 on a live run to save it under world/recordings/ (see world/recordings/RECORD.md).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { HEADLESS } from "../../config/claude";
import { WORLD } from "../sim/state";

export const RECORDINGS = join(WORLD, "recordings");

export type Status = { installed: boolean; version: string | null; signedIn: boolean; how: string };

// Ask `claude` itself: its version, and `claude auth status`. Never read a credentials file.
export function claudeStatus(): Status {
  const v = Bun.spawnSync(["claude", "--version"], { stdout: "pipe", stderr: "pipe" });
  if (!v.success) return { installed: false, version: null, signedIn: false, how: "not installed" };
  const version = v.stdout.toString().match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  const a = Bun.spawnSync(["claude", "auth", "status"], { stdout: "pipe", stderr: "pipe" });
  let signedIn = false;
  let how = "not signed in";
  try {
    const j = JSON.parse(a.stdout.toString());
    signedIn = j.loggedIn === true;
    if (signedIn) how = j.subscriptionType ? `signed in (${j.subscriptionType} plan)` : j.authMethod === "api_key" ? "signed in with a Console account" : "signed in";
  } catch { /* an older claude prints text: treat a clean exit as signed in */ signedIn = a.success; how = signedIn ? "signed in" : how; }
  return { installed: true, version, signedIn, how };
}

export type Mode = "live" | "replay";
export function mode(): { mode: Mode; why: string } {
  if (process.env.CLAUDE_REPLAY === "1") return { mode: "replay", why: "CLAUDE_REPLAY=1 is set" };
  if (process.env.CI) return { mode: "replay", why: "this is CI" };
  const s = claudeStatus();
  if (!s.installed) return { mode: "replay", why: "Claude Code is not installed" };
  if (!s.signedIn) return { mode: "replay", why: "Claude Code is not signed in (run claude, then /login)" };
  return { mode: "live", why: `Claude Code ${s.version}, ${s.how}` };
}

export type Event = Record<string, any>;
export type Run = { mode: Mode; events: Event[]; result: Event | undefined; recording: string };

export const recordingPath = (name: string) => join(RECORDINGS, `${name}.jsonl`);
export const hasRecording = (name: string) => existsSync(recordingPath(name));

// The one change made to a saved transcript: the model's id becomes "account-default", so no model name ships in
// the course. Every other byte is what `claude -p` printed. Lines that are not JSON are dropped.
export const MODEL_PLACEHOLDER = "account-default";
export function redact(out: string): string {
  const fix = (v: any): any => {
    if (Array.isArray(v)) return v.map(fix);
    if (!v || typeof v !== "object") return v;
    const o: any = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === "model" && typeof x === "string") o[k] = MODEL_PLACEHOLDER;
      else if (k === "modelUsage" && x && typeof x === "object") o[k] = Object.fromEntries(Object.values(x as object).map((u: any, i) => [i ? `${MODEL_PLACEHOLDER}-${i + 1}` : MODEL_PLACEHOLDER, fix({ ...u, canonicalModel: undefined })]));
      else o[k] = fix(x);
    }
    return o;
  };
  return out.split("\n").filter((l) => l.startsWith("{")).map((l) => { try { return JSON.stringify(fix(JSON.parse(l))); } catch { return null; } }).filter(Boolean).join("\n") + "\n";
}

export function readRecording(name: string): Event[] {
  const p = recordingPath(name);
  if (!existsSync(p)) throw new Error(`No recording at world/recordings/${name}.jsonl. Record it with a signed-in Claude Code: see world/recordings/RECORD.md.`);
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Start `claude -p` in `cwd` and wait for it. The stream-json lines are the transcript; the last one is the result.
export function runClaude(o: { name: string; cwd: string; prompt: string; args: string[]; env?: Record<string, string | undefined>; live: boolean; timeoutMs?: number }): Run {
  if (!o.live) {
    const events = readRecording(o.name);
    return { mode: "replay", events, result: events.findLast((e) => e.type === "result"), recording: o.name };
  }
  const p = Bun.spawnSync(["claude", "-p", o.prompt, ...HEADLESS, ...o.args], {
    cwd: o.cwd,
    env: { ...process.env, ...o.env },
    stdout: "pipe",
    stderr: "pipe",
    timeout: o.timeoutMs ?? 600_000,
  });
  const out = p.stdout.toString();
  const events = out.split("\n").filter((l) => l.startsWith("{")).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as Event[];
  if (!events.length) throw new Error(`claude -p printed nothing it could read. Its error output:\n${p.stderr.toString().trim()}`);
  if (process.env.CLAUDE_RECORD === "1") {
    const f = recordingPath(o.name);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, redact(out));
  }
  return { mode: "live", events, result: events.findLast((e) => e.type === "result"), recording: o.name };
}

// The parts of a transcript a person reads: what was asked, what Claude Code said, each tool call and what came
// back. Never the model's name, the session id or the cost.
export type Line = { kind: "said" | "tool" | "result" | "blocked"; text: string; call?: { tool_name: string; tool_input: any } };
export function transcript(events: Event[]): Line[] {
  const out: Line[] = [];
  for (const e of events) {
    for (const c of e.message?.content ?? []) {
      if (e.type === "assistant" && c.type === "text" && c.text.trim()) out.push({ kind: "said", text: c.text.trim() });
      if (e.type === "assistant" && c.type === "tool_use") out.push({ kind: "tool", text: describe(c.name, c.input), call: { tool_name: c.name, tool_input: c.input } });
      if (e.type === "user" && c.type === "tool_result") {
        const body = typeof c.content === "string" ? c.content : (c.content ?? []).map((x: any) => x.text ?? "").join("\n");
        out.push({ kind: /Blocked by guard-infra|denied/i.test(body) && c.is_error ? "blocked" : "result", text: body.trim() });
      }
    }
  }
  return out;
}
const describe = (tool: string, input: any) =>
  tool === "Bash" ? `Bash: ${input.command}` : input?.file_path ? `${tool}: ${input.file_path}` : `${tool}: ${JSON.stringify(input).slice(0, 120)}`;
