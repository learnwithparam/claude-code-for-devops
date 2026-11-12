import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
export const read = (dir: string, ...p: string[]) => {
  const f = join(dir, ...p);
  return existsSync(f) ? readFileSync(f, "utf8") : "";
};
export const exists = (dir: string, ...p: string[]) => existsSync(join(dir, ...p));
// The text under one Markdown heading, up to the next heading of any level.
export function section(md: string, heading: string): string {
  const lines = md.split("\n");
  const i = lines.findIndex(
    (l) =>
      /^#+\s/.test(l) &&
      l
        .replace(/^#+\s*/, "")
        .trim()
        .toLowerCase() === heading.toLowerCase(),
  );
  if (i < 0) return "";
  const rest = lines.slice(i + 1);
  const j = rest.findIndex((l) => /^#+\s/.test(l));
  return (j < 0 ? rest : rest.slice(0, j)).join("\n").trim();
}
