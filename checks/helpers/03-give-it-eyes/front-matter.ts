// Reads the YAML front matter at the top of a Markdown file, between two --- lines.
export function frontMatter(markdown: string): Record<string, unknown> {
  const found = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!found) return {};
  try {
    return (Bun.YAML.parse(found[1]) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

// A field that may be a YAML list or a comma-separated string, as a clean list of words.
export function listField(value: unknown): string[] {
  let items: unknown[] = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === "string") items = value.split(",");
  const words = items.map((item) => String(item).trim());
  return words.filter(Boolean);
}
