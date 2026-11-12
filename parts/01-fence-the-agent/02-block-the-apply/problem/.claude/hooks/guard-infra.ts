#!/usr/bin/env bun
// PreToolUse guard for the Tallowmark infra repo.
// Claude Code sends the tool call as JSON on stdin. Exit 2 blocks it, and what you print on stderr is shown to Claude.
// Exit 0 lets the normal permission rules decide.
import { readFileSync } from "node:fs";

const call = JSON.parse(readFileSync(0, "utf8"));
const tool: string = call.tool_name;
const command: string = call.tool_input?.command ?? "";
const filePath: string = call.tool_input?.file_path ?? "";

// TODO: block the dangerous calls. Start with terraform apply.

process.exit(0);
