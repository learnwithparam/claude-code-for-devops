// Finds Conftest at the pinned version, or downloads that exact release into .cache/.
// The release checksum is checked before the file is used.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../scripts/structure";

export const CONFTEST_VERSION = "0.71.1";
const CACHE_FOLDER = join(ROOT, ".cache", `conftest-${CONFTEST_VERSION}`);
const RELEASES = "https://github.com/open-policy-agent/conftest/releases/download";
const RELEASE = `${RELEASES}/v${CONFTEST_VERSION}`;
const SYSTEM = process.platform === "darwin" ? "Darwin" : "Linux";
const CHIP = process.arch === "arm64" ? "arm64" : "x86_64";
const ARCHIVE = `conftest_${CONFTEST_VERSION}_${SYSTEM}_${CHIP}.tar.gz`;

export function runConftest(binary: string, args: string[], cwd: string) {
  // The version flag takes no colour flag; every other command gets plain text.
  const plain = args[0] === "--version" ? [] : ["--no-color"];
  const result = Bun.spawnSync([binary, ...args, ...plain], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = `${result.stdout.toString()}${result.stderr.toString()}`;
  return { code: result.exitCode, output };
}

function versionOf(binary: string): string {
  try {
    return runConftest(binary, ["--version"], ROOT).output;
  } catch {
    return "";
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function install(): Promise<string> {
  mkdirSync(CACHE_FOLDER, { recursive: true });
  const archive = await download(`${RELEASE}/${ARCHIVE}`);
  const checksums = (await download(`${RELEASE}/checksums.txt`)).toString();
  const expected = checksums
    .split("\n")
    .find((line) => line.endsWith(ARCHIVE))
    ?.split(/\s+/)[0];
  const actual = createHash("sha256").update(archive).digest("hex");
  if (expected !== actual) throw new Error(`checksum mismatch for ${ARCHIVE}`);
  const archivePath = join(CACHE_FOLDER, ARCHIVE);
  writeFileSync(archivePath, archive);
  Bun.spawnSync(["tar", "xzf", archivePath, "-C", CACHE_FOLDER, "conftest"]);
  chmodSync(join(CACHE_FOLDER, "conftest"), 0o755);
  return join(CACHE_FOLDER, "conftest");
}

// The path of a Conftest binary at the pinned version.
export async function ensureConftest(): Promise<string> {
  if (versionOf("conftest").includes(`Conftest: ${CONFTEST_VERSION}`)) return "conftest";
  const cached = join(CACHE_FOLDER, "conftest");
  if (existsSync(cached) && versionOf(cached).includes(CONFTEST_VERSION)) return cached;
  return install();
}
