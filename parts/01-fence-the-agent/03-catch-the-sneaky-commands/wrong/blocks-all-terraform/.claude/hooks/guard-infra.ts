#!/usr/bin/env bun
// PreToolUse guard for the Tallowmark infra repo.
// Exit 2 blocks the tool call and tells Claude why. Exit 0 lets the normal permission rules decide.
// It fails closed: input it cannot read is blocked.
// It is a guardrail, not a wall: the sandbox is the wall.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Programs that run another program, such as `sudo terraform apply`. We look past them.
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

// Text that points at cloud keys, SSH keys, .env files, kube configs or Terraform state.
const SECRET_PATTERNS = [
  /(^|[\s'"=/~])\.aws\//,
  /(^|[\s'"=/~])\.ssh\//,
  /(^|[\s'"=/])\.env(\.(local|prod\w*))?($|[\s'"])/,
  /\.kube\/(config|prod)/,
  /\.tfstate\b/,
];

const TERRAFORM_PROGRAMS = ["terraform", "tofu", "terragrunt"];
const TERRAFORM_STATE_WRITES = ["rm", "mv", "push", "replace-provider"];

const KUBECTL_OPTIONS_WITH_VALUE = [
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
];
const KUBECTL_WRITE_VERBS = [
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
];

const HELM_OPTIONS_WITH_VALUE = [
  "--kube-context",
  "-n",
  "--namespace",
  "--kubeconfig",
  "-f",
  "--values",
  "--set",
];
const HELM_WRITE_VERBS = ["install", "upgrade", "uninstall", "delete", "del", "rollback"];

const AWS_OPTIONS_WITH_VALUE = ["--profile", "--region", "--output", "--endpoint-url"];
const GIT_OPTIONS_WITH_VALUE = ["-C", "-c", "--git-dir", "--work-tree"];

// A guard does not follow scripts that call scripts forever.
const DEEPEST_NESTING = 3;

function block(reason: string): never {
  console.error(
    `Blocked by guard-infra: ${reason}. Plan, explain and review instead; a person applies.`,
  );
  process.exit(2);
}

// Claude Code sends JSON such as
// {"tool_name":"Bash","tool_input":{"command":"terraform plan"},"cwd":"/repo"}.
function readToolCall() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return block("could not read the tool call");
  }
}

function isSecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

// Split a command line into simple commands at && || ; | and new lines.
// Also pull out the commands inside $( ) and backticks.
function splitIntoSimpleCommands(commandLine: string): string[] {
  const substitutions = [...commandLine.matchAll(/\$\(([^)]*)\)|`([^`]*)`/g)];
  const innerCommands = substitutions.map((match) => match[1] ?? match[2] ?? "");
  const outerCommands = commandLine.split(/&&|\|\||;|\||\n/);
  const allCommands = [...outerCommands, ...innerCommands];
  const trimmedCommands = allCommands.map((simpleCommand) => simpleCommand.trim());
  return trimmedCommands.filter(Boolean);
}

// Split one simple command into words, and keep each quoted string as one word.
function splitIntoWords(simpleCommand: string): string[] {
  const words: string[] = [];
  for (const match of simpleCommand.matchAll(/'([^']*)'|"((?:\\.|[^"])*)"|(\S+)/g)) {
    words.push(match[1] ?? match[2] ?? match[3]);
  }
  return words;
}

// "/usr/bin/terraform" becomes "terraform".
function programName(word: string): string {
  return word.split("/").pop() ?? word;
}

// A word such as FOO=bar sets a variable for the command that follows it.
function isVariableSetting(word: string): boolean {
  return /^\w+=/.test(word);
}

function isWrapperOption(word: string): boolean {
  const isDuration = /^\d+[smh]?$/.test(word);
  return word.startsWith("-") || isVariableSetting(word) || isDuration;
}

function dropWrapperOptions(words: string[]): string[] {
  let remaining = words;
  while (remaining.length > 0 && isWrapperOption(remaining[0])) {
    // xargs -I and nice -n take a value, so that word goes too.
    const takesValue = remaining[0] === "-I" || remaining[0] === "-n";
    remaining = remaining.slice(takesValue ? 2 : 1);
  }
  return remaining;
}

// Drop VAR=value words and wrappers such as env, sudo and xargs, with their options.
function dropWrappers(words: string[]): string[] {
  let remaining = words;
  while (remaining.length > 0) {
    const firstWord = remaining[0];
    if (isVariableSetting(firstWord)) {
      remaining = remaining.slice(1);
    } else if (WRAPPERS.has(programName(firstWord))) {
      remaining = dropWrapperOptions(remaining.slice(1));
    } else {
      break;
    }
  }
  return remaining;
}

// Skip the options before the verb, and the value after each option that takes one.
function findVerb(
  args: string[],
  optionsWithValue: string[] = [],
): { verb: string | undefined; rest: string[] } {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-")) {
      return { verb: arg, rest: args.slice(i + 1) };
    }
    if (optionsWithValue.includes(arg)) {
      i++;
    }
  }
  return { verb: undefined, rest: [] };
}

function checkTerraform(program: string, args: string[]): void {
  const { verb, rest } = findVerb(args);
  const subcommand = rest[0];
  if (verb) {
    block(`${program} ${verb} changes real infrastructure`);
  }
  if (verb === "state" && TERRAFORM_STATE_WRITES.includes(subcommand)) {
    block(`${program} state ${subcommand} rewrites the state`);
  }
  if (verb === "workspace" && subcommand === "delete") {
    block(`${program} workspace delete removes an environment`);
  }
}

function checkKubectl(args: string[]): void {
  const { verb } = findVerb(args, KUBECTL_OPTIONS_WITH_VALUE);
  if (KUBECTL_WRITE_VERBS.includes(verb ?? "")) {
    block(`kubectl ${verb} changes a cluster`);
  }
}

function checkHelm(args: string[]): void {
  const { verb } = findVerb(args, HELM_OPTIONS_WITH_VALUE);
  if (HELM_WRITE_VERBS.includes(verb ?? "")) {
    block(`helm ${verb} changes a release`);
  }
}

function isAwsRead(service: string | undefined, operation: string | undefined): boolean {
  if (/^(get-|list-|describe-|head-)/.test(operation ?? "")) {
    return true;
  }
  if (service === "s3" && operation === "ls") {
    return true;
  }
  return service === "sts" && operation === "get-caller-identity";
}

// Only reads are allowed: aws s3 ls, and the get, list, describe and head operations.
function checkAws(args: string[]): void {
  const { verb: service, rest } = findVerb(args, AWS_OPTIONS_WITH_VALUE);
  const { verb: operation } = findVerb(rest, ["--bucket"]);
  if (!isAwsRead(service, operation)) {
    block(`aws ${service} ${operation} is not a read`);
  }
}

// A push option or refspec (such as +main) that overwrites or deletes history on the remote.
function rewritesHistory(arg: string): boolean {
  const isForceOption = /^(-f|--force|--force-with-lease|--mirror|--delete|-d)$/.test(arg);
  return isForceOption || arg.startsWith("+") || arg.startsWith("--force");
}

function checkGit(args: string[]): void {
  const { verb, rest } = findVerb(args, GIT_OPTIONS_WITH_VALUE);
  if (verb === "push" && rest.some(rewritesHistory)) {
    block("git push --force rewrites shared history");
  }
  if (verb === "reset" && rest.includes("--hard")) {
    block("git reset --hard throws away work");
  }
}

function checkRm(args: string[]): void {
  const isRecursive = args.some((arg) => /^-\w*r/.test(arg));
  const hitsInfrastructure = args.some((arg) => /terraform|\.tfstate|^~|^\$HOME|^\/$/.test(arg));
  if (isRecursive && hitsInfrastructure) {
    block("rm -r on infrastructure code, state or your home folder");
  }
}

function checkProgram(program: string, args: string[]): void {
  if (TERRAFORM_PROGRAMS.includes(program)) {
    checkTerraform(program, args);
  }
  if (program === "kubectl" || program === "oc") {
    checkKubectl(args);
  }
  if (program === "helm") {
    checkHelm(args);
  }
  if (program === "aws") {
    checkAws(args);
  }
  if (program === "git") {
    checkGit(args);
  }
  if (program === "rm") {
    checkRm(args);
  }
}

// A script the agent runs could hold any command, so we read the script and check it too.
function checkScriptFile(scriptFile: string, depth: number): void {
  const scriptPath = resolve(workingFolder, scriptFile);
  if (!existsSync(scriptPath)) {
    block(`it runs a script I cannot read: ${scriptFile}`);
  }
  const scriptLines = readFileSync(scriptPath, "utf8").split("\n");
  const codeLines = scriptLines.filter((line) => !line.trim().startsWith("#"));
  checkCommand(codeLines.join("\n"), depth + 1);
}

// `bash -c "..."` runs the text after -c. `bash deploy.sh` and `./deploy.sh` run a script file.
function checkShell(words: string[], depth: number): void {
  const program = programName(words[0]);
  const args = words.slice(1);
  const inlineFlag = args.indexOf("-c");
  if (inlineFlag >= 0) {
    checkCommand(args[inlineFlag + 1] ?? "", depth + 1);
    return;
  }
  let scriptFile: string | undefined = words[0];
  if (SHELLS.has(program)) {
    scriptFile = args.find((arg) => !arg.startsWith("-"));
  }
  if (scriptFile) {
    checkScriptFile(scriptFile, depth);
  }
}

function runsShell(firstWord: string): boolean {
  const isShell = SHELLS.has(programName(firstWord));
  return isShell || /\.sh$/.test(firstWord) || firstWord.startsWith("./");
}

function checkSimpleCommand(simpleCommand: string, depth: number): void {
  const words = dropWrappers(splitIntoWords(simpleCommand));
  if (words.length === 0) {
    return;
  }
  if (runsShell(words[0])) {
    checkShell(words, depth);
  } else {
    checkProgram(programName(words[0]), words.slice(1));
  }
}

function checkCommand(commandLine: string, depth = 0): void {
  if (depth > DEEPEST_NESTING) {
    block("commands nested too deep to read");
  }
  if (isSecret(commandLine)) {
    block("it reads a secret: cloud keys, SSH keys, .env or Terraform state");
  }
  for (const simpleCommand of splitIntoSimpleCommands(commandLine)) {
    checkSimpleCommand(simpleCommand, depth);
  }
}

const toolCall = readToolCall();
// Relative script paths are read from the folder Claude Code is working in.
const workingFolder = toolCall.cwd ?? process.cwd();
const toolName = toolCall.tool_name;
const toolInput = toolCall.tool_input ?? {};

if (toolName === "Bash") {
  checkCommand(String(toolInput.command ?? ""));
} else if (typeof toolInput.file_path === "string" && isSecret(toolInput.file_path)) {
  block(`${toolName} on a secret file`);
}
process.exit(0);
