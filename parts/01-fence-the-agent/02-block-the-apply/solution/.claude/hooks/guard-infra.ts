#!/usr/bin/env bun
// PreToolUse guard for the Tallowmark infra repo.
// Claude Code sends the tool call as JSON on stdin.
// Exit 2 blocks it, and what you print on stderr is shown to Claude.
// Exit 0 lets the normal permission rules decide.
// Input we cannot read is blocked: the guard fails closed.
import { readFileSync } from "node:fs";

const DANGEROUS_COMMANDS = [
  {
    pattern: /\bterraform\s+(apply|destroy|import|taint)\b/,
    reason: "terraform apply and destroy change real infrastructure",
  },
  {
    pattern: /\bterraform\s+state\s+(rm|mv|push)\b/,
    reason: "terraform state rm rewrites the state",
  },
  {
    pattern: /\bterraform\s+workspace\s+delete\b/,
    reason: "deleting a workspace removes an environment",
  },
  {
    pattern: /\bkubectl\s+(delete|apply|scale|drain|patch|edit|cordon)\b/,
    reason: "kubectl writes change a cluster",
  },
  {
    pattern: /\bhelm\s+(install|upgrade|uninstall|rollback)\b/,
    reason: "helm writes change a release",
  },
  {
    pattern: /\baws\s+s3\s+(rb|rm|mv|sync)\b/,
    reason: "aws s3 writes delete or move data",
  },
  {
    pattern: /\baws\s+s3api\s+(put|delete)-/,
    reason: "aws s3api put and delete change a bucket",
  },
  {
    pattern: /\bgit\s+push\b.*(--force|\s-f\b)/,
    reason: "a force push rewrites shared history",
  },
];

function block(reason: string): never {
  console.error(`Blocked by guard-infra: ${reason}. Plan and explain instead; a person applies.`);
  process.exit(2);
}

// Claude Code sends JSON such as
// {"tool_name":"Bash","tool_input":{"command":"terraform plan"}}.
function readToolCall() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return block("could not read the tool call");
  }
}

const toolCall = readToolCall();
const tool = toolCall.tool_name;
const command = toolCall.tool_input?.command ?? "";
const filePath = toolCall.tool_input?.file_path ?? "";

if (tool === "Bash") {
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (dangerous.pattern.test(command)) {
      block(dangerous.reason);
    }
  }
}
if (tool === "Read" || tool === "Edit" || tool === "Write") {
  if (/(^|\/)\.env$/.test(filePath)) {
    block("the .env file holds secrets");
  }
  if (/\/\.aws\//.test(filePath)) {
    block("~/.aws holds cloud keys");
  }
}
process.exit(0);
