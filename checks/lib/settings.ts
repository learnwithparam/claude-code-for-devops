// Reads a learner's .claude/settings.json and answers questions about it the way Claude Code would.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Settings = {
  permissions?: {
    allow?: string[];
    deny?: string[];
    ask?: string[];
    defaultMode?: string;
    disableBypassPermissionsMode?: string;
    disableAutoMode?: string;
  };
  hooks?: Record<
    string,
    {
      matcher?: string;
      hooks: { type: string; command: string; args?: string[]; timeout?: number }[];
    }[]
  >;
  sandbox?: {
    enabled?: boolean;
    failIfUnavailable?: boolean;
    allowUnsandboxedCommands?: boolean;
    filesystem?: {
      denyRead?: string[];
      allowRead?: string[];
      allowWrite?: string[];
      denyWrite?: string[];
    };
    network?: { allowedDomains?: string[] };
  };
  [field: string]: unknown;
};

export const settingsPath = (dir: string) => join(dir, ".claude", "settings.json");

export function readSettings(dir: string): Settings | null {
  const path = settingsPath(dir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const escapeForRegex = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

// A Bash rule: * matches anything, and a trailing " *" or ":*" also matches the bare command.
function bashRuleMatches(specifier: string, command: string): boolean {
  const pattern = specifier.replace(/:\*$/, " *");
  const escapedPieces = pattern.split("*").map(escapeForRegex);
  const regex = new RegExp(`^${escapedPieces.join(".*")}$`);
  if (regex.test(command)) return true;
  return pattern.endsWith(" *") && command === pattern.slice(0, -2);
}

// Read and Edit use gitignore-style paths. We test the path forms a learner is likely to write.
function pathRuleMatches(specifier: string, path: string): boolean {
  const glob = specifier.replace(/^\.\//, "");
  // Placeholders keep ** apart from * while the single stars are turned into regex.
  const anyFolders = "\u0000";
  const anythingAtEnd = "\u0001";
  const withPlaceholders = escapeForRegex(glob)
    .replace(/\*\*\//g, anyFolders)
    .replace(/\*\*$/, anythingAtEnd);
  const regexText = withPlaceholders
    .replace(/\*/g, "[^/]*")
    .replaceAll(anyFolders, "(.*/)?")
    .replace(anythingAtEnd, ".*");
  const regex = new RegExp(`^${regexText}$`);
  const relativePath = path.replace(/^\.\//, "");
  const forms = [path, relativePath, `/${relativePath}`];
  const formMatches = (form: string) => {
    const withoutLeadingSlash = form.replace(/^\//, "");
    return regex.test(form) || regex.test(withoutLeadingSlash);
  };
  return forms.some(formMatches);
}

// Claude Code's rule form: Tool or Tool(specifier).
// For Bash, a trailing " *" or ":*" is a prefix match.
export function ruleMatches(rule: string, tool: string, input: string): boolean {
  const ruleParts = rule.match(/^(\w+)(?:\((.*)\))?$/);
  if (!ruleParts || ruleParts[1] !== tool) return false;
  const specifier = ruleParts[2];
  if (specifier === undefined) return true;
  if (tool === "Bash") return bashRuleMatches(specifier, input);
  return pathRuleMatches(specifier, input);
}

// Simple wrappers Claude Code strips before it matches: VAR=value, env, nohup, nice, timeout, time.
const WRAPPERS = ["env", "nohup", "nice", "timeout", "time"];
const isWrapper = (word: string) => /^\w+=/.test(word) || WRAPPERS.includes(word);

function stripWrappers(commandPart: string): string {
  let words = commandPart.trim().split(/\s+/);
  while (words.length > 0 && isWrapper(words[0])) words = words.slice(1);
  return words.join(" ");
}

// Claude Code splits compound commands and strips simple wrappers before it matches a Bash rule.
// It does not follow a full path, a shell -c string, a flag before the verb, another program name
// or a script file.
export function bashParts(command: string): string[] {
  const commandParts = command.split(/&&|\|\||;|\|/);
  return commandParts.map(stripWrappers).filter(Boolean);
}

export const denies = (settings: Settings | null, tool: string, input: string) => {
  const denyRules = settings?.permissions?.deny ?? [];
  const pieces = tool === "Bash" ? bashParts(input) : [input];
  return pieces.some((piece) => denyRules.some((rule) => ruleMatches(rule, tool, piece)));
};

export const allows = (settings: Settings | null, tool: string, input: string) => {
  const allowRules = settings?.permissions?.allow ?? [];
  return allowRules.some((rule) => ruleMatches(rule, tool, input));
};
