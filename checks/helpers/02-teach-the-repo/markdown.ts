// Small readers for the Markdown files Claude Code writes in this part: front matter, headings
// and code blocks. They live here until the supervisor moves them to checks/lib.

// The YAML between the first two "---" lines, or null when the file has none or it does not parse.
export function frontMatter(markdown: string): Record<string, unknown> | null {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    const parsed = Bun.YAML.parse(match[1]);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

// Every heading's text, in lower case, without the # marks.
export function headings(markdown: string): string[] {
  const headingLines = markdown.split("\n").filter((line) => /^#{1,6}\s/.test(line));
  return headingLines.map((line) =>
    line
      .replace(/^#+\s*/, "")
      .trim()
      .toLowerCase(),
  );
}

export const hasHeading = (markdown: string, heading: string) =>
  headings(markdown).includes(heading.toLowerCase());

// The lines inside every fenced code block of the text.
export function codeLines(markdown: string): string[] {
  const lines: string[] = [];
  let insideBlock = false;
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith("```")) {
      insideBlock = !insideBlock;
      continue;
    }
    if (insideBlock && line.trim()) lines.push(line.trim());
  }
  return lines;
}

// A front matter field that may be a list or one string, as a list of strings.
export function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

// Does a path-scoped rule pattern match this file? A pattern with no slash matches the file name
// in any folder. Any other pattern is read from the repo root, as Claude Code does for rules.
export function pathPatternMatches(pattern: string, file: string): boolean {
  const cleanPattern = pattern.trim().replace(/^\.?\//, "");
  if (!cleanPattern.includes("/")) {
    const fileName = file.split("/").pop() ?? file;
    return new Bun.Glob(cleanPattern).match(fileName);
  }
  return new Bun.Glob(cleanPattern).match(file);
}
