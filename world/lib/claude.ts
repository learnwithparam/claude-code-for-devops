// The one place the course starts Claude Code. It runs the real `claude` CLI, signed in with
// your own Claude account, or replays a run recorded from it. It never calls a model API and
// never needs a key.
//
// Live when `claude` is installed and signed in, and this is not CI.
// Replay otherwise, or when CLAUDE_REPLAY=1.
// Set CLAUDE_RECORD=1 on a live run to save it under world/recordings/
// (see world/recordings/RECORD.md).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { HEADLESS } from "../../config/claude";
import { WORLD } from "../sim/state";

export const RECORDINGS = join(WORLD, "recordings");

export type Status = { installed: boolean; version: string | null; signedIn: boolean; how: string };

const NOT_INSTALLED: Status = {
  installed: false,
  version: null,
  signedIn: false,
  how: "not installed",
};

// What `claude auth status` prints as JSON.
type AuthStatus = { loggedIn?: boolean; subscriptionType?: string; authMethod?: string };

function describeSignIn(auth: AuthStatus): string {
  if (auth.subscriptionType) return `signed in (${auth.subscriptionType} plan)`;
  if (auth.authMethod === "api_key") return "signed in with a Console account";
  return "signed in";
}

function readSignIn(): { signedIn: boolean; how: string } {
  const authRun = Bun.spawnSync(["claude", "auth", "status"], { stdout: "pipe", stderr: "pipe" });
  try {
    const auth: AuthStatus = JSON.parse(authRun.stdout.toString());
    const signedIn = auth.loggedIn === true;
    if (!signedIn) return { signedIn, how: "not signed in" };
    return { signedIn, how: describeSignIn(auth) };
  } catch {
    // An older claude prints text instead of JSON, so a clean exit counts as signed in.
    const signedIn = authRun.success;
    return { signedIn, how: signedIn ? "signed in" : "not signed in" };
  }
}

// Ask `claude` itself: its version, and `claude auth status`. Never read a credentials file.
export function claudeStatus(): Status {
  if (!Bun.which("claude")) return NOT_INSTALLED;
  const versionRun = Bun.spawnSync(["claude", "--version"], { stdout: "pipe", stderr: "pipe" });
  if (!versionRun.success) return NOT_INSTALLED;
  const versionText = versionRun.stdout.toString();
  const version = versionText.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  const { signedIn, how } = readSignIn();
  return { installed: true, version, signedIn, how };
}

export type Mode = "live" | "replay";
export function mode(): { mode: Mode; why: string } {
  if (process.env.CLAUDE_REPLAY === "1") return { mode: "replay", why: "CLAUDE_REPLAY=1 is set" };
  if (process.env.CI) return { mode: "replay", why: "this is CI" };
  const status = claudeStatus();
  if (!status.installed) return { mode: "replay", why: "Claude Code is not installed" };
  if (!status.signedIn)
    return { mode: "replay", why: "Claude Code is not signed in (run claude, then /login)" };
  return { mode: "live", why: `Claude Code ${status.version}, ${status.how}` };
}

// The input a tool call carries. Each tool has its own fields, such as command or file_path.
type ToolInput = { command?: string; [field: string]: unknown };

// One block inside a message: text, a tool call, or what a tool sent back.
type ContentBlock = {
  type: string;
  text?: string;
  name?: string;
  input?: ToolInput;
  content?: string | { text?: string }[];
  // Other fields, such as is_error on a tool result.
  [field: string]: unknown;
};

// One line of `claude -p --output-format stream-json`. The field names are Claude Code's own.
export type Event = {
  type?: string;
  subtype?: string;
  message?: { content?: ContentBlock[] };
  [field: string]: unknown;
};
export type Run = { mode: Mode; events: Event[]; result: Event | undefined; recording: string };

export const recordingPath = (name: string) => join(RECORDINGS, `${name}.jsonl`);
export const hasRecording = (name: string) => existsSync(recordingPath(name));

// The one change made to a saved transcript: the model's id becomes "account-default", so no
// model name ships in the course. Every other byte is what `claude -p` printed.
// Lines that are not JSON are dropped.
export const MODEL_PLACEHOLDER = "account-default";

const isModelId = (key: string) => /^claude-|^(opus|sonnet|haiku|fable)\b/i.test(key);

// Usage is keyed by model id, so an object key that is a model id is replaced too.
// The first one becomes the placeholder, the next ones get a number after it.
function hideModelsInObject(original: object): Record<string, unknown> {
  const hidden: Record<string, unknown> = {};
  let modelKeysSeen = 0;
  for (const [key, value] of Object.entries(original)) {
    let newKey = key;
    if (isModelId(key)) {
      newKey = modelKeysSeen ? `${MODEL_PLACEHOLDER}-${modelKeysSeen + 1}` : MODEL_PLACEHOLDER;
      modelKeysSeen++;
    }
    const namesModel = /model/i.test(key) && typeof value === "string";
    hidden[newKey] = namesModel ? MODEL_PLACEHOLDER : hideModels(value);
  }
  return hidden;
}

// Any string under a key that names a model is replaced, at any depth.
function hideModels(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(hideModels);
  if (!value || typeof value !== "object") return value;
  return hideModelsInObject(value);
}

// Reads every line that starts with "{" as JSON and skips the ones that do not parse.
function parseJsonLines(output: string): unknown[] {
  const jsonLines = output.split("\n").filter((line) => line.startsWith("{"));
  const parsed = jsonLines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  });
  return parsed.filter(Boolean);
}

export function redact(output: string): string {
  const hiddenEvents = parseJsonLines(output).map(hideModels);
  const redactedLines = hiddenEvents.map((event) => JSON.stringify(event));
  return `${redactedLines.join("\n")}\n`;
}

export function readRecording(name: string): Event[] {
  const path = recordingPath(name);
  if (!existsSync(path))
    throw new Error(
      `No recording at world/recordings/${name}.jsonl. ` +
        "Record it with a signed-in Claude Code: see world/recordings/RECORD.md.",
    );
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

type RunOptions = {
  name: string;
  cwd: string;
  prompt: string;
  args: string[];
  env?: Record<string, string | undefined>;
  live: boolean;
  timeoutMs?: number;
};

const lastResult = (events: Event[]) => events.findLast((event) => event.type === "result");

// When Claude Code stops before its first turn, it says why in the result's errors list.
// Show that reason, so a learner can look it up in 00-orientation/troubleshooting.md.
// It goes to stderr, so a command that prints only JSON on stdout stays clean.
function explainFailedStart(result: Event | undefined) {
  const errors = Array.isArray(result?.errors) ? (result.errors as unknown[]) : [];
  for (const error of errors) console.error(`Claude Code stopped: ${String(error)}`);
  const sandboxIsMissing = errors.some((error) => /sandbox/i.test(String(error)));
  if (sandboxIsMissing) {
    console.error(
      "The finished settings need the sandbox. On Linux or WSL, install it with: " +
        "sudo apt-get install bubblewrap socat",
    );
  }
}

// Start `claude -p` in `cwd` and wait for it.
// The stream-json lines are the transcript; the last one is the result.
export function runClaude(options: RunOptions): Run {
  if (!options.live) {
    const events = readRecording(options.name);
    return { mode: "replay", events, result: lastResult(events), recording: options.name };
  }
  const command = ["claude", "-p", options.prompt, ...HEADLESS, ...options.args];
  const claudeRun = Bun.spawnSync(command, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
    timeout: options.timeoutMs ?? 600_000,
  });
  const output = claudeRun.stdout.toString();
  const events = parseJsonLines(output) as Event[];
  if (!events.length) {
    const errorOutput = claudeRun.stderr.toString().trim();
    throw new Error(`claude -p printed nothing it could read. Its error output:\n${errorOutput}`);
  }
  explainFailedStart(lastResult(events));
  if (process.env.CLAUDE_RECORD === "1") {
    const savedFile = recordingPath(options.name);
    mkdirSync(dirname(savedFile), { recursive: true });
    writeFileSync(savedFile, redact(output));
  }
  return { mode: "live", events, result: lastResult(events), recording: options.name };
}

// The parts of a transcript a person reads: what was asked, what Claude Code said, each tool
// call and what came back. Never the model's name, the session id or the cost.
export type Line = {
  kind: "said" | "tool" | "result" | "blocked";
  text: string;
  // The same field names a PreToolUse hook receives, so a call can be fed to a hook as it is.
  call?: HookCall;
};
type HookCall = Record<"tool_name" | "tool_input", unknown>;

function describe(tool: string, input: ToolInput | undefined): string {
  if (tool === "Bash") return `Bash: ${(input as ToolInput).command}`;
  if (input?.file_path) return `${tool}: ${input.file_path}`;
  return `${tool}: ${JSON.stringify(input).slice(0, 120)}`;
}

function toolResultLine(block: ContentBlock): Line {
  let body = "";
  if (typeof block.content === "string") body = block.content;
  else body = (block.content ?? []).map((part) => part.text ?? "").join("\n");
  const blocked = /Blocked by guard-infra|denied/i.test(body) && block.is_error;
  return { kind: blocked ? "blocked" : "result", text: body.trim() };
}

function assistantLine(block: ContentBlock): Line | undefined {
  if (block.type === "text") {
    const said = (block.text as string).trim();
    if (said) return { kind: "said", text: said };
    return undefined;
  }
  if (block.type !== "tool_use") return undefined;
  const tool = block.name as string;
  // biome-ignore lint/style/useNamingConvention: a PreToolUse hook reads these exact field names.
  const call: HookCall = { tool_name: tool, tool_input: block.input };
  return { kind: "tool", text: describe(tool, block.input), call };
}

function lineFor(event: Event, block: ContentBlock): Line | undefined {
  if (event.type === "assistant") return assistantLine(block);
  if (event.type === "user" && block.type === "tool_result") return toolResultLine(block);
  return undefined;
}

export function transcript(events: Event[]): Line[] {
  const lines: Line[] = [];
  for (const event of events) {
    for (const block of event.message?.content ?? []) {
      const line = lineFor(event, block);
      if (line) lines.push(line);
    }
  }
  return lines;
}
