// A small reader for the subset of Terraform's language this world uses:
// blocks with labels, attributes, nested blocks, strings, numbers, booleans, lists and maps.
// It is not Terraform. It is enough to plan the practice repo without installing anything.
export type Block = { type: string; labels: string[]; body: Body };
export type Body = { attrs: Record<string, unknown>; blocks: Block[] };

type TokenKind = "name" | "string" | "number" | "symbol";
type Token = { kind: TokenKind; text: string };

const KEYWORD_VALUES = new Map<string, unknown>([
  ["true", true],
  ["false", false],
  ["null", null],
]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    position = readToken(source, position, tokens);
  }
  return tokens;
}

// Reads one token, or skips one space or comment, and returns where the next one starts.
function readToken(source: string, position: number, tokens: Token[]): number {
  const character = source[position];
  const nextCharacter = source[position + 1];
  if (character === "#" || (character === "/" && nextCharacter === "/")) {
    return endOfLine(source, position);
  }
  if (character === "/" && nextCharacter === "*") {
    return source.indexOf("*/", position + 2) + 2;
  }
  if (character === "\n") {
    // Line breaks are kept because they end an attribute, like a comma does.
    tokens.push({ kind: "symbol", text: "\n" });
    return position + 1;
  }
  if (/\s/.test(character)) {
    return position + 1;
  }
  if (character === '"') {
    return readString(source, position, tokens);
  }
  if (/[0-9]/.test(character)) {
    return readWhile(source, { position, kind: "number", allowed: /[0-9.]/ }, tokens);
  }
  if (/[A-Za-z_]/.test(character)) {
    const allowed = /[A-Za-z0-9_.\-[\]*]/;
    return readWhile(source, { position, kind: "name", allowed }, tokens);
  }
  tokens.push({ kind: "symbol", text: character });
  return position + 1;
}

function endOfLine(source: string, position: number): number {
  const lineBreak = source.indexOf("\n", position);
  if (lineBreak === -1) {
    return source.length;
  }
  return lineBreak;
}

function readString(source: string, openingQuote: number, tokens: Token[]): number {
  let position = openingQuote + 1;
  let text = "";
  while (source[position] !== '"') {
    if (source[position] === "\\") {
      text += source[position + 1];
      position += 2;
    } else {
      text += source[position];
      position += 1;
    }
  }
  tokens.push({ kind: "string", text });
  return position + 1;
}

type Run = { position: number; kind: TokenKind; allowed: RegExp };

function readWhile(source: string, run: Run, tokens: Token[]): number {
  let end = run.position;
  while (run.allowed.test(source[end] ?? "")) {
    end++;
  }
  tokens.push({ kind: run.kind, text: source.slice(run.position, end) });
  return end;
}

// Walks the tokens once, from the first to the last, and builds the body they describe.
class HclParser {
  private readonly tokens: Token[];
  private position = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.position];
  }

  private take(): Token {
    const token = this.tokens[this.position];
    this.position++;
    return token;
  }

  // Line breaks and commas only separate things, so the parser steps over them.
  private skipSeparators() {
    while (this.peek()?.text === "\n" || this.peek()?.text === ",") {
      this.position++;
    }
  }

  private expect(text: string) {
    const found = this.tokens[this.position]?.text;
    if (found !== text) {
      throw new Error(`expected "${text}" near token ${this.position} (${found})`);
    }
    this.position++;
  }

  value(): unknown {
    this.skipSeparators();
    const token = this.take();
    if (token.kind === "string") {
      return token.text;
    }
    if (token.kind === "number") {
      return Number(token.text);
    }
    if (token.kind === "name") {
      return this.nameValue(token.text);
    }
    if (token.text === "[") {
      return this.listValue();
    }
    if (token.text === "{") {
      return this.mapValue();
    }
    throw new Error(`unexpected "${token.text}"`);
  }

  private nameValue(name: string): unknown {
    if (KEYWORD_VALUES.has(name)) {
      return KEYWORD_VALUES.get(name);
    }
    return name;
  }

  private listValue(): unknown[] {
    const items: unknown[] = [];
    this.skipSeparators();
    while (this.peek().text !== "]") {
      items.push(this.value());
      this.skipSeparators();
    }
    this.position++;
    return items;
  }

  private mapValue(): Record<string, unknown> {
    const entries: Record<string, unknown> = {};
    this.skipSeparators();
    while (this.peek().text !== "}") {
      const key = this.take().text;
      this.expect("=");
      entries[key] = this.value();
      this.skipSeparators();
    }
    this.position++;
    return entries;
  }

  // Reads attributes and blocks until the closing text, or until the file ends when there is none.
  body(closingText: string | null): Body {
    const body: Body = { attrs: {}, blocks: [] };
    for (;;) {
      this.skipSeparators();
      if (this.position >= this.tokens.length) {
        if (closingText) {
          throw new Error("missing }");
        }
        return body;
      }
      if (this.peek().text === closingText) {
        this.position++;
        return body;
      }
      this.attributeOrBlock(body);
    }
  }

  private attributeOrBlock(body: Body) {
    const name = this.take();
    if (name.kind !== "name") {
      throw new Error(`unexpected "${name.text}"`);
    }
    if (this.peek().text === "=") {
      this.position++;
      body.attrs[name.text] = this.value();
      return;
    }
    const labels: string[] = [];
    while (this.peek().kind === "string") {
      labels.push(this.take().text);
    }
    this.expect("{");
    body.blocks.push({ type: name.text, labels, body: this.body("}") });
  }
}

export function parseHcl(source: string): Body {
  const parser = new HclParser(tokenize(source));
  return parser.body(null);
}

// Turn a body into plain JSON: nested blocks become arrays of objects, as in Terraform's plan JSON.
export function toJson(body: Body): Record<string, unknown> {
  const json: Record<string, unknown> = { ...body.attrs };
  for (const block of body.blocks) {
    const sameTypeBlocks = (json[block.type] ?? []) as unknown[];
    sameTypeBlocks.push(toJson(block.body));
    json[block.type] = sameTypeBlocks;
  }
  return json;
}
