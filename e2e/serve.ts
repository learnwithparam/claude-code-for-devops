// Builds the board page, then serves it so the text audit has something to open.
// Usage: bun e2e/serve.ts <port>
import { join, normalize } from "node:path";

const port = Number(process.argv[2] ?? 3017);
const root = join(import.meta.dir, "..");
const buildResult = Bun.spawnSync(["bun", "world/board.ts", "--html"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
if (buildResult.exitCode !== 0) process.exit(buildResult.exitCode ?? 1);

const pageFolder = join(root, process.env.TALLOWMARK_HOME ?? "world/live");

Bun.serve({
  port,
  async fetch(request) {
    const requestPath = new URL(request.url).pathname;
    const pagePath = requestPath === "/" ? "/board.html" : requestPath;
    const file = Bun.file(join(pageFolder, normalize(pagePath)));
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});
console.log(`Serving ${pageFolder} on http://localhost:${port}`);
