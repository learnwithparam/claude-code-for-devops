// bun run audit: write the board page, serve it, run the shared text audit on it.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./structure";

const home = mkdtempSync(join(tmpdir(), "board-audit-"));
// biome-ignore lint/style/useNamingConvention: environment variable name
const env = { ...process.env, TALLOWMARK_HOME: home };
const write = Bun.spawnSync(["bun", "world/board.ts", "--html"], { cwd: ROOT, env });
if (write.exitCode !== 0) {
  console.error(write.stderr.toString());
  process.exit(1);
}

const server = Bun.serve({
  port: 0,
  fetch: () =>
    new Response(readFileSync(join(home, "board.html")), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
});
const run = Bun.spawn(
  ["bunx", "playwright", "test", "--config", "e2e/playwright.config.ts", ...process.argv.slice(2)],
  {
    cwd: ROOT,
    // biome-ignore lint/style/useNamingConvention: environment variable name
    env: { ...process.env, AUDIT_URL: `http://localhost:${server.port}` },
    stdout: "inherit",
    stderr: "inherit",
  },
);
const exitCode = await run.exited;
server.stop(true);
process.exit(exitCode);
