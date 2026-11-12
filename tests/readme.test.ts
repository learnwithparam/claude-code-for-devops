// From a fresh world with no model key, every command in the root README and the orientation
// prints its Expect line.
import { expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

// One ```bash block: the commands in it, and the `quoted` parts of the Expect: line after it.
type CommandBlock = { commands: string[]; expected: string[] };

// The Expect: line after a block may wrap onto the next lines, up to a blank line.
function expectTextAfter(lines: string[], blockEnd: number): string {
  let lineIndex = blockEnd + 1;
  while (!lines[lineIndex].startsWith("Expect:")) lineIndex++;
  let text = lines[lineIndex];
  while (lines[lineIndex + 1]?.trim()) {
    lineIndex++;
    text += ` ${lines[lineIndex]}`;
  }
  return text;
}

function commandBlocks(file: string): CommandBlock[] {
  const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
  const blocks: CommandBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "```bash") continue;
    let j = i + 1;
    const commands: string[] = [];
    while (lines[j].trim() !== "```") commands.push(lines[j++]);
    const expectText = expectTextAfter(lines, j);
    const quotedParts = [...expectText.matchAll(/`([^`]+)`/g)];
    blocks.push({ commands, expected: quotedParts.map((match) => match[1]) });
    i = j;
  }
  return blocks;
}

const sameSpacing = (text: string) => text.replace(/\s+/g, " ");

function runBlock(block: CommandBlock, env: Record<string, string | undefined>): string {
  let output = "";
  for (const command of block.commands) {
    const result = Bun.spawnSync(["sh", "-c", command], { cwd: ROOT, env });
    output += result.stdout.toString() + result.stderr.toString();
  }
  return output;
}

// An Expect: part that only repeats the command itself is not an output to look for.
function isOnlyTheCommand(block: CommandBlock, expected: string): boolean {
  if (block.commands.includes(expected)) return true;
  return block.commands.some((command) => command.startsWith(expected));
}

for (const file of ["00-orientation/README.md", "README.md"]) {
  test(`${file}: every command prints its Expect line`, () => {
    if (file === "00-orientation/README.md") {
      rmSync(join(ROOT, "world", "live"), { recursive: true, force: true });
    }
    // biome-ignore-start lint/style/useNamingConvention: these are environment variable names.
    const env: Record<string, string | undefined> = {
      ...process.env,
      CLAUDE_REPLAY: "1",
      TALLOWMARK_HOME: undefined,
    };
    // biome-ignore-end lint/style/useNamingConvention: these are environment variable names.
    // Commands that are Claude Code itself only run where it is installed.
    // A fresh clone in CI has none.
    const hasClaude = Bun.spawnSync(["sh", "-c", "command -v claude"]).success;
    for (const block of commandBlocks(file)) {
      const runsClaude = block.commands.some((command) => /^claude\b/.test(command.trim()));
      if (!hasClaude && runsClaude) continue;
      const output = runBlock(block, env);
      const outputsToFind = block.expected.filter((expected) => !isOnlyTheCommand(block, expected));
      for (const expected of outputsToFind) {
        expect(sameSpacing(output)).toContain(sameSpacing(expected));
      }
    }
  }, 120_000);
}
