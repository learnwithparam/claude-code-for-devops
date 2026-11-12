// Reads a learner's .claude/settings.json and answers questions about it the way Claude Code would.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Settings = {
  permissions?: { allow?: string[]; deny?: string[]; ask?: string[]; defaultMode?: string; disableBypassPermissionsMode?: string; disableAutoMode?: string };
  hooks?: Record<string, { matcher?: string; hooks: { type: string; command: string; args?: string[]; timeout?: number }[] }[]>;
  sandbox?: {
    enabled?: boolean; failIfUnavailable?: boolean; allowUnsandboxedCommands?: boolean;
    filesystem?: { denyRead?: string[]; allowRead?: string[]; allowWrite?: string[]; denyWrite?: string[] };
    network?: { allowedDomains?: string[] };
  };
  [k: string]: unknown;
};

export const settingsPath = (dir: string) => join(dir, ".claude", "settings.json");

export function readSettings(dir: string): Settings | null {
  const p = settingsPath(dir);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

// Claude Code's rule form: Tool or Tool(specifier). For Bash, a trailing " *" or ":*" is a prefix match.
export function ruleMatches(rule: string, tool: string, input: string): boolean {
  const m = rule.match(/^(\w+)(?:\((.*)\))?$/);
  if (!m || m[1] !== tool) return false;
  const spec = m[2];
  if (spec === undefined) return true;
  if (tool === "Bash") {
    const pat = spec.replace(/:\*$/, " *");
    const re = new RegExp("^" + pat.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    return re.test(input) || (pat.endsWith(" *") && input === pat.slice(0, -2));
  }
  // Read and Edit use gitignore-style paths. We test the path forms a learner is likely to write.
  const glob = spec.replace(/^\.\//, "");
  const re = new RegExp(
    "^" + glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(.*/)?") + "$",
  );
  const forms = [input, input.replace(/^\.\//, ""), "/" + input.replace(/^\.\//, "")];
  return forms.some((f) => re.test(f) || re.test(f.replace(/^\//, "")));
}

export const denies = (s: Settings | null, tool: string, input: string) => (s?.permissions?.deny ?? []).some((r) => ruleMatches(r, tool, input));
export const allows = (s: Settings | null, tool: string, input: string) => (s?.permissions?.allow ?? []).some((r) => ruleMatches(r, tool, input));
