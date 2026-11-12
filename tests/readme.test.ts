// From a fresh world with no model key, every command in the root README and the orientation prints its Expect line.
import { expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const blocks = (file: string) => {
  const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
  const out: { cmds: string[]; expect: string[] }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "```bash") continue;
    let j = i + 1;
    const cmds: string[] = [];
    while (lines[j].trim() !== "```") cmds.push(lines[j++]);
    let k = j + 1;
    while (!lines[k].startsWith("Expect:")) k++;
    let text = lines[k];
    while (lines[k + 1]?.trim()) text += " " + lines[++k];
    out.push({ cmds, expect: [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]) });
    i = j;
  }
  return out;
};
const norm = (s: string) => s.replace(/\s+/g, " ");

for (const file of ["00-orientation/README.md", "README.md"]) {
  test(`${file}: every command prints its Expect line`, () => {
    if (file === "00-orientation/README.md")
      rmSync(join(ROOT, "world", "live"), { recursive: true, force: true });
    const env: Record<string, string | undefined> = {
      ...process.env,
      CLAUDE_REPLAY: "1",
      TALLOWMARK_HOME: undefined,
    };
    // Commands that are Claude Code itself only run where it is installed; a fresh clone in CI has none.
    const hasClaude = Bun.spawnSync(["sh", "-c", "command -v claude"]).success;
    for (const b of blocks(file)) {
      if (!hasClaude && b.cmds.some((c) => /^claude\b/.test(c.trim()))) continue;
      let out = "";
      for (const c of b.cmds) {
        const r = Bun.spawnSync(["sh", "-c", c], { cwd: ROOT, env });
        out += r.stdout.toString() + r.stderr.toString();
      }
      for (const e of b.expect.filter(
        (e) => !b.cmds.includes(e) && !b.cmds.some((c) => c.startsWith(e)),
      ))
        expect(norm(out)).toContain(norm(e));
    }
  }, 120_000);
}
