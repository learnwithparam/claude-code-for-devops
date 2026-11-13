#!/usr/bin/env bun
// PreToolUse guard for the Tallowmark infra repo.
// Claude Code sends the tool call as JSON on stdin.
// Exit 2 blocks it, and what you print on stderr is shown to Claude.
// Exit 0 lets the normal permission rules decide.
import { readFileSync } from "node:fs";

const toolCall = JSON.parse(readFileSync(0, "utf8"));

// These are the values a guard checks. The starter reads them but does not use them yet.
// biome-ignore-start lint/correctness/noUnusedVariables: the guard you build will use these values
const tool: string = toolCall.tool_name;
const command: string = toolCall.tool_input?.command ?? "";
const filePath: string = toolCall.tool_input?.file_path ?? "";
// biome-ignore-end lint/correctness/noUnusedVariables: the guard you build will use these values

// TODO: block the dangerous calls. Start with terraform apply.

process.exit(0);
