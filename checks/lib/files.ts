import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The text of a file inside dir, or "" when the file is not there.
export const read = (dir: string, ...pathParts: string[]) => {
  const file = join(dir, ...pathParts);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
};

export const exists = (dir: string, ...pathParts: string[]) => existsSync(join(dir, ...pathParts));

const isHeading = (line: string) => /^#+\s/.test(line);

function headingText(line: string): string {
  const withoutHashes = line.replace(/^#+\s*/, "");
  return withoutHashes.trim().toLowerCase();
}

// The text under one Markdown heading, up to the next heading of any level.
export function section(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const wanted = heading.toLowerCase();
  const headingIndex = lines.findIndex((line) => isHeading(line) && headingText(line) === wanted);
  if (headingIndex < 0) return "";
  const rest = lines.slice(headingIndex + 1);
  const nextHeading = rest.findIndex(isHeading);
  const body = nextHeading < 0 ? rest : rest.slice(0, nextHeading);
  return body.join("\n").trim();
}
