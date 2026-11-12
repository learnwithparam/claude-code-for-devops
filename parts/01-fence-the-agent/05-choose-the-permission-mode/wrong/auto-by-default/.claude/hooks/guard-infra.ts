#!/usr/bin/env bun
// PreToolUse guard for the Tallowmark infra repo.
// Exit 2 blocks the tool call and tells Claude why. Exit 0 lets the normal permission rules decide.
// It fails closed: input it cannot read is blocked. It is a guardrail, not a wall: the sandbox is the wall.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const block = (why: string): never => {
  console.error(
    `Blocked by guard-infra: ${why}. Plan, explain and review instead; a person applies.`,
  );
  process.exit(2);
};

let call: any;
try {
  call = JSON.parse(readFileSync(0, "utf8"));
} catch {
  block("could not read the tool call");
}
const cwd: string = call.cwd ?? process.cwd();

const SECRET = [
  /(^|[\s'"=/~])\.aws\//,
  /(^|[\s'"=/~])\.ssh\//,
  /(^|[\s'"=/])\.env(\.(local|prod\w*))?($|[\s'"])/,
  /\.kube\/(config|prod)/,
  /\.tfstate\b/,
];
const secret = (s: string) => SECRET.some((r) => r.test(s));

// Split a command line into simple commands at && || ; | and newlines, and pull out $( ) and backtick bodies.
function segments(cmd: string): string[] {
  const inner = [...cmd.matchAll(/\$\(([^)]*)\)|`([^`]*)`/g)].map((m) => m[1] ?? m[2]);
  return [...cmd.split(/&&|\|\||;|\||\n/), ...inner].map((s) => s.trim()).filter(Boolean);
}

// Split one simple command into words, keeping quoted strings together.
function words(seg: string): string[] {
  const out: string[] = [];
  for (const m of seg.matchAll(/'([^']*)'|"((?:\\.|[^"])*)"|(\S+)/g))
    out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const WRAPPERS = new Set([
  "env",
  "sudo",
  "nohup",
  "time",
  "nice",
  "command",
  "exec",
  "xargs",
  "timeout",
  "watch",
  "setsid",
  "doas",
]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash"]);
const base = (w: string) => w.split("/").pop() ?? w;

// Drop leading flags (and their values) to find the verb.
function verbAfter(args: string[], takesValue: string[]): [string | undefined, string[]] {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("-")) {
      if (takesValue.includes(a)) i++;
      continue;
    }
    return [a, args.slice(i + 1)];
  }
  return [undefined, []];
}

function checkCommand(cmd: string, depth = 0): void {
  if (depth > 3) block("commands nested too deep to read");
  if (secret(cmd)) block("it reads a secret: cloud keys, SSH keys, .env or Terraform state");
  for (const seg of segments(cmd)) {
    let w = words(seg);
    // Strip VAR=value prefixes and wrappers such as env, sudo and xargs, with their flags.
    while (w.length) {
      if (/^\w+=/.test(w[0])) {
        w = w.slice(1);
        continue;
      }
      if (WRAPPERS.has(base(w[0]))) {
        w = w.slice(1);
        while (w.length && (w[0].startsWith("-") || /^\w+=/.test(w[0]) || /^\d+[smh]?$/.test(w[0])))
          w = w.slice(w[0] === "-I" || w[0] === "-n" ? 2 : 1);
        continue;
      }
      break;
    }
    if (!w.length) continue;
    const prog = base(w[0]);
    const args = w.slice(1);

    if (SHELLS.has(prog) || /\.sh$/.test(w[0]) || w[0].startsWith("./")) {
      const c = args.indexOf("-c");
      if (c >= 0) {
        checkCommand(args[c + 1] ?? "", depth + 1);
        continue;
      }
      const file = SHELLS.has(prog) ? args.find((a) => !a.startsWith("-")) : w[0];
      if (!file) continue;
      const path = resolve(cwd, file);
      if (!existsSync(path)) block(`it runs a script I cannot read: ${file}`);
      checkCommand(
        readFileSync(path, "utf8")
          .split("\n")
          .filter((l) => !l.trim().startsWith("#"))
          .join("\n"),
        depth + 1,
      );
      continue;
    }
    if (prog === "terraform" || prog === "tofu" || prog === "terragrunt") {
      const [verb, rest] = verbAfter(args, []);
      if (
        ["apply", "destroy", "import", "taint", "untaint", "force-unlock", "run-all"].includes(
          verb ?? "",
        )
      )
        block(`${prog} ${verb} changes real infrastructure`);
      if (verb === "state" && ["rm", "mv", "push", "replace-provider"].includes(rest[0]))
        block(`${prog} state ${rest[0]} rewrites the state`);
      if (verb === "workspace" && rest[0] === "delete")
        block(`${prog} workspace delete removes an environment`);
    }
    if (prog === "kubectl" || prog === "oc") {
      const [verb] = verbAfter(args, [
        "--context",
        "-n",
        "--namespace",
        "--kubeconfig",
        "-l",
        "--selector",
        "-o",
        "--cluster",
        "--user",
        "-f",
      ]);
      if (
        [
          "delete",
          "apply",
          "create",
          "replace",
          "patch",
          "edit",
          "scale",
          "drain",
          "cordon",
          "uncordon",
          "rollout",
          "exec",
          "cp",
          "set",
          "label",
          "annotate",
          "taint",
          "autoscale",
        ].includes(verb ?? "")
      )
        block(`kubectl ${verb} changes a cluster`);
    }
    if (prog === "helm") {
      const [verb] = verbAfter(args, [
        "--kube-context",
        "-n",
        "--namespace",
        "--kubeconfig",
        "-f",
        "--values",
        "--set",
      ]);
      if (["install", "upgrade", "uninstall", "delete", "del", "rollback"].includes(verb ?? ""))
        block(`helm ${verb} changes a release`);
    }
    if (prog === "aws") {
      const [svc, rest] = verbAfter(args, ["--profile", "--region", "--output", "--endpoint-url"]);
      const [op] = verbAfter(rest, ["--bucket"]);
      const read =
        /^(get-|list-|describe-|head-)/.test(op ?? "") ||
        (svc === "s3" && op === "ls") ||
        (svc === "sts" && op === "get-caller-identity");
      if (!read) block(`aws ${svc} ${op} is not a read`);
    }
    if (prog === "git") {
      const [verb, rest] = verbAfter(args, ["-C", "-c", "--git-dir", "--work-tree"]);
      if (
        verb === "push" &&
        rest.some(
          (a) =>
            /^(-f|--force|--force-with-lease|--mirror|--delete|-d)$/.test(a) ||
            a.startsWith("+") ||
            a.startsWith("--force"),
        )
      )
        block("git push --force rewrites shared history");
      if (verb === "reset" && rest.includes("--hard")) block("git reset --hard throws away work");
    }
    if (
      prog === "rm" &&
      args.some((a) => /^-\w*r/.test(a)) &&
      args.some((a) => /terraform|\.tfstate|^~|^\$HOME|^\/$/.test(a))
    )
      block("rm -r on infrastructure code, state or your home folder");
  }
}

const tool: string = call.tool_name;
const input = call.tool_input ?? {};
if (tool === "Bash") checkCommand(String(input.command ?? ""));
else if (typeof input.file_path === "string" && secret(input.file_path))
  block(`${tool} on a secret file`);
process.exit(0);
