#!/usr/bin/env bun
// Safe, but useless: the agent cannot even run terraform plan.
console.error("Blocked by guard-infra: nothing runs here.");
process.exit(2);
