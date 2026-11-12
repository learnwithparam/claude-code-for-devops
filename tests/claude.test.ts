// The course runs on the real Claude Code and nothing else.
// These run with no Claude Code and no key.
import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { cases, payload } from "../checks/lib/guard";
import { RECORDINGS, readRecording } from "../world/lib/claude";

const ROOT = join(import.meta.dir, "..");
const SKIPPED_FOLDERS = ["node_modules", ".git", "live", ".finished"];

function everyFile(folder: string, found: string[] = []): string[] {
  for (const entry of readdirSync(folder)) {
    if (SKIPPED_FOLDERS.includes(entry)) continue;
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) everyFile(path, found);
    else found.push(path);
  }
  return found;
}

// The banned words this file holds, written as "file: word".
function bannedWordsIn(file: string, banned: string[]): string[] {
  const text = readFileSync(file, "utf8").toLowerCase();
  const found = banned.filter((word) => text.includes(word.toLowerCase()));
  return found.map((word) => `${relative(ROOT, file)}: ${word}`);
}

test("no model API, provider switch or API key anywhere in the repo", () => {
  const banned = [
    "@ai-sdk/",
    "@anthropic-ai/sdk",
    "openrouter",
    "LLM_PROVIDER",
    "ANTHROPIC_" + "API_KEY",
  ];
  const textFiles = everyFile(ROOT).filter(
    (file) =>
      !file.endsWith(".png") && !file.endsWith(".jsonl") && !file.endsWith("claude.test.ts"),
  );
  const hits = textFiles.flatMap((file) => bannedWordsIn(file, banned));
  expect(hits).toEqual([]);
});

test("the guard suite sends every field a real Claude Code PreToolUse hook gets", () => {
  for (const tool of ["bash", "read"]) {
    const recordingFile = join(RECORDINGS, "hook-input", `pretooluse-${tool}.json`);
    expect(existsSync(recordingFile)).toBe(true);
    const real = JSON.parse(readFileSync(recordingFile, "utf8"));
    const plantedCase = cases().find((planted) => planted.tool_name.toLowerCase() === tool);
    if (!plantedCase) throw new Error(`no planted case for the ${tool} tool`);
    const planted = payload(plantedCase);
    // scratchpad_dir is documented as absent when a session has none, so a hook cannot rely on it.
    const needed = Object.keys(real).filter((field) => field !== "scratchpad_dir");
    expect(needed.filter((field) => !(field in planted))).toEqual([]);
    expect(planted.hook_event_name).toBe(real.hook_event_name);
    expect(typeof planted.tool_input).toBe(typeof real.tool_input);
  }
});

test(
  "every recording is a whole claude -p transcript: " +
    "it holds Claude Code's init and ends with a result",
  () => {
    const recordings = everyFile(RECORDINGS).filter(
      (file) => file.endsWith(".jsonl") && !file.includes("/logs/"),
    );
    expect(recordings.length).toBeGreaterThanOrEqual(3 * 6 + 3 + 1);
    for (const file of recordings) {
      const name = relative(RECORDINGS, file).replace(/\.jsonl$/, "");
      const events = readRecording(name);
      const init = events.find((event) => event.type === "system" && event.subtype === "init");
      expect(init).toBeDefined();
      expect(typeof init?.claude_code_version).toBe("string");
      expect(events.at(-1)?.type).toBe("result");
      expect(readFileSync(file, "utf8")).not.toMatch(
        /claude-(opus|sonnet|haiku|fable)|\b(opus|sonnet|haiku|fable) \d/i,
      );
    }
  },
);

test("bun run demo replays a real session in which the guard blocks the apply", () => {
  const demo = Bun.spawnSync(["bun", "run", "demo"], {
    cwd: ROOT,
    // biome-ignore lint/style/useNamingConvention: CLAUDE_REPLAY is an environment variable.
    env: { ...process.env, CLAUDE_REPLAY: "1" },
  });
  const output = demo.stdout.toString();
  expect(output).toContain("Replaying a recorded Claude Code session");
  expect(output).toContain("BLOCKED  Blocked by guard-infra: terraform apply");
  expect(output).toContain("Changes it made to the world: 0.");
  expect(output).not.toMatch(/claude-(opus|sonnet|haiku|fable)/i);
});
