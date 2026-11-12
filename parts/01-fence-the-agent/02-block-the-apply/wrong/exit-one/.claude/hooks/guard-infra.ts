#!/usr/bin/env bun
// PreToolUse guard for the Tallowmark infra repo.
// Claude Code sends the tool call as JSON on stdin. Exit 2 blocks it, and what you print on stderr is shown to Claude.
// Exit 0 lets the normal permission rules decide. Input we cannot read is blocked: the guard fails closed.
import { readFileSync } from "node:fs";

const block = (why: string): never => {
  console.error(`Blocked by guard-infra: ${why}. Plan and explain instead; a person applies.`);
  process.exit(1);
};

let call: any;
try {
  call = JSON.parse(readFileSync(0, "utf8"));
} catch {
  block("could not read the tool call");
}
const tool: string = call.tool_name;
const command: string = call.tool_input?.command ?? "";
const filePath: string = call.tool_input?.file_path ?? "";

const DANGEROUS: [RegExp, string][] = [
  [
    /\bterraform\s+(apply|destroy|import|taint)\b/,
    "terraform apply and destroy change real infrastructure",
  ],
  [/\bterraform\s+state\s+(rm|mv|push)\b/, "terraform state rm rewrites the state"],
  [/\bterraform\s+workspace\s+delete\b/, "deleting a workspace removes an environment"],
  [/\bkubectl\s+(delete|apply|scale|drain|patch|edit|cordon)\b/, "kubectl writes change a cluster"],
  [/\bhelm\s+(install|upgrade|uninstall|rollback)\b/, "helm writes change a release"],
  [/\baws\s+s3\s+(rb|rm|mv|sync)\b/, "aws s3 writes delete or move data"],
  [/\baws\s+s3api\s+(put|delete)-/, "aws s3api put and delete change a bucket"],
  [/\bgit\s+push\b.*(--force|\s-f\b)/, "a force push rewrites shared history"],
];

if (tool === "Bash") {
  for (const [re, why] of DANGEROUS) if (re.test(command)) block(why);
}
if (tool === "Read" || tool === "Edit" || tool === "Write") {
  if (/(^|\/)\.env$/.test(filePath)) block("the .env file holds secrets");
  if (/\/\.aws\//.test(filePath)) block("~/.aws holds cloud keys");
}
process.exit(0);
