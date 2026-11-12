// The course runs on the real Claude Code and nothing else. These run with no Claude Code and no key.
import { test, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { payload, cases } from "../checks/lib/guard";
import { RECORDINGS, readRecording } from "../world/lib/claude";

const ROOT = join(import.meta.dir, "..");
const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of readdirSync(dir)) {
    if (["node_modules", ".git", "live", ".finished"].includes(e)) continue;
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

test("no model API, provider switch or API key anywhere in the repo", () => {
  const banned = ["@ai-sdk/", "@anthropic-ai/sdk", "openrouter", "LLM_PROVIDER", "ANTHROPIC_" + "API_KEY"];
  const hits = walk(ROOT)
    .filter((f) => !f.endsWith(".png") && !f.endsWith(".jsonl") && !f.endsWith("claude.test.ts"))
    .flatMap((f) => banned.filter((b) => readFileSync(f, "utf8").toLowerCase().includes(b.toLowerCase())).map((b) => `${relative(ROOT, f)}: ${b}`));
  expect(hits).toEqual([]);
});

test("the guard suite sends every field a real Claude Code PreToolUse hook gets", () => {
  for (const tool of ["bash", "read"]) {
    const f = join(RECORDINGS, "hook-input", `pretooluse-${tool}.json`);
    expect(existsSync(f)).toBe(true);
    const real = JSON.parse(readFileSync(f, "utf8"));
    const planted = payload(cases().find((c) => c.tool_name.toLowerCase() === tool)!);
    // scratchpad_dir is documented as absent when a session has none, so a hook cannot rely on it.
    const need = Object.keys(real).filter((k) => k !== "scratchpad_dir");
    expect(need.filter((k) => !(k in planted))).toEqual([]);
    expect(planted.hook_event_name).toBe(real.hook_event_name);
    expect(typeof planted.tool_input).toBe(typeof real.tool_input);
  }
});

test("every recording is a whole claude -p transcript: it holds Claude Code's init and ends with a result", () => {
  const files = walk(RECORDINGS).filter((f) => f.endsWith(".jsonl") && !f.includes("/logs/"));
  expect(files.length).toBeGreaterThanOrEqual(3 * 6 + 3 + 1);
  for (const f of files) {
    const ev = readRecording(relative(RECORDINGS, f).replace(/\.jsonl$/, ""));
    const init = ev.find((e) => e.type === "system" && e.subtype === "init");
    expect(init).toBeDefined();
    expect(typeof init!.claude_code_version).toBe("string");
    expect(ev.at(-1)?.type).toBe("result");
    expect(readFileSync(f, "utf8")).not.toMatch(/claude-(opus|sonnet|haiku|fable)|\b(opus|sonnet|haiku|fable) \d/i);
  }
});

test("bun run demo replays a real session in which the guard blocks the apply", () => {
  const r = Bun.spawnSync(["bun", "run", "demo"], { cwd: ROOT, env: { ...process.env, CLAUDE_REPLAY: "1" } });
  const out = r.stdout.toString();
  expect(out).toContain("Replaying a recorded Claude Code session");
  expect(out).toContain("BLOCKED  Blocked by guard-infra: terraform apply");
  expect(out).toContain("Changes it made to the world: 0.");
  expect(out).not.toMatch(/claude-(opus|sonnet|haiku|fable)/i);
});
