// A small reader for the subset of Terraform's language this world uses:
// blocks with labels, attributes, nested blocks, strings, numbers, booleans, lists and maps.
// It is not Terraform. It is enough to plan the practice repo without installing anything.
export type Block = { type: string; labels: string[]; body: Body };
export type Body = { attrs: Record<string, unknown>; blocks: Block[] };

type Tok = { t: "id" | "str" | "num" | "sym"; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "#" || (c === "/" && src[i + 1] === "/")) { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 2; continue; }
    if (c === "\n") { out.push({ t: "sym", v: "\n" }); i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1, s = "";
      while (src[j] !== '"') { if (src[j] === "\\") { s += src[j + 1]; j += 2; } else s += src[j++]; }
      out.push({ t: "str", v: s }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) { let j = i; while (/[0-9.]/.test(src[j])) j++; out.push({ t: "num", v: src.slice(i, j) }); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (/[A-Za-z0-9_.\-\[\]*]/.test(src[j] ?? "")) j++; out.push({ t: "id", v: src.slice(i, j) }); i = j; continue; }
    out.push({ t: "sym", v: c }); i++;
  }
  return out;
}

export function parseHcl(src: string): Body {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const skipNl = () => { while (peek()?.v === "\n" || peek()?.v === ",") p++; };
  const expect = (v: string) => { if (toks[p]?.v !== v) throw new Error(`expected "${v}" near token ${p} (${toks[p]?.v})`); p++; };

  function value(): unknown {
    skipNl();
    const k = toks[p++];
    if (k.t === "str") return k.v;
    if (k.t === "num") return Number(k.v);
    if (k.t === "id") return k.v === "true" ? true : k.v === "false" ? false : k.v === "null" ? null : k.v;
    if (k.v === "[") { const arr: unknown[] = []; skipNl(); while (peek().v !== "]") { arr.push(value()); skipNl(); } p++; return arr; }
    if (k.v === "{") {
      const obj: Record<string, unknown> = {}; skipNl();
      while (peek().v !== "}") { const key = toks[p++].v; expect("="); obj[key] = value(); skipNl(); }
      p++; return obj;
    }
    throw new Error(`unexpected "${k.v}"`);
  }

  function body(end: string | null): Body {
    const b: Body = { attrs: {}, blocks: [] };
    for (;;) {
      skipNl();
      if (p >= toks.length) { if (end) throw new Error("missing }"); return b; }
      if (peek().v === end) { p++; return b; }
      const name = toks[p++];
      if (name.t !== "id") throw new Error(`unexpected "${name.v}"`);
      if (peek().v === "=") { p++; b.attrs[name.v] = value(); continue; }
      const labels: string[] = [];
      while (peek().t === "str") labels.push(toks[p++].v);
      expect("{");
      b.blocks.push({ type: name.v, labels, body: body("}") });
    }
  }
  return body(null);
}

// Turn a body into plain JSON: nested blocks become arrays of objects, as in Terraform's plan JSON.
export function toJson(b: Body): Record<string, unknown> {
  const o: Record<string, unknown> = { ...b.attrs };
  for (const blk of b.blocks) ((o[blk.type] ??= []) as unknown[]).push(toJson(blk.body));
  return o;
}
