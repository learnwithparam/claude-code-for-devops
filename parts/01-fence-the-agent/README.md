# Fence the agent

## The problem

A Claude Code session that runs with no prompts can do real damage in one tool call. In issue
[#93099](https://github.com/anthropics/claude-code/issues/93099) a user reports that a session with edits auto-accepted ran
`rm -rf "$HOME"` during test cleanup and deleted 57,235 files and 11,315 directories. Asking the person each time is
not a guard either: Anthropic reports that users accept 93% of permission prompts
([How we built Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode)).

At Tallowmark Tickets the agent sits in `tallowmark-infra`, and the shell starts on prod. One `terraform destroy` takes
out the buyer records. One `kubectl delete ns seat` means no fan can buy a ticket.

The fix is not a line in a prompt. It is layers that do not depend on what the agent decides, and a test that proves
each layer works.

```mermaid
flowchart LR
  C[Tool call from Claude Code] --> D{Deny rules}
  D -->|matches the text| X1[Blocked]
  D -->|no match| H{PreToolUse hook}
  H -->|exit 2| X2[Blocked]
  H -->|exit 0| S{Sandbox}
  S -->|reads ~/.aws or calls an unknown host| X3[Blocked by the OS]
  S -->|allowed| R[Runs]
  G[Guard suite: 45 planted calls] -.-> H
```

## What you build

| Step | Minutes | You produce | The check reads |
|---|---|---|---|
| `write-the-deny-rules` | 15 | Deny rules in `.claude/settings.json` | Your settings, matched the way Claude Code matches rules |
| `block-the-apply` | 25 | A PreToolUse hook, wired in settings | The hook's exit code and JSON on 20 dangerous and 15 safe planted calls |
| `catch-the-sneaky-commands` | 20 | A hook that also stops 10 bypass forms, and a note of your deny rule gaps | The hook on 45 calls, and your gaps against your own rules |
| `sandbox-the-shell` | 20 | A sandbox block in settings | Your sandbox keys, and the guard suite again |
| `choose-the-permission-mode` | 10 | A permission mode and a note on when to use each one | Your settings and the note |

Every step starts from the last step's sample answer, so you can start any step fresh.

## Walkthrough

Point the world repo at a step's work, so a real Claude Code session in the world uses your settings and hook:

```bash
bun run world use write-the-deny-rules
```

Expect: `The world repo now uses parts/01-fence-the-agent/01-write-the-deny-rules/problem/.claude as its .claude folder.`

Check each step in order. Each prints PASS or FAIL lines, and a Try next line under every FAIL.

```bash
bun run verify write-the-deny-rules
bun run verify block-the-apply
bun run verify catch-the-sneaky-commands
bun run verify sandbox-the-shell
bun run verify choose-the-permission-mode
```

Expect: `Done. All 8 rules pass.`, then 6, 6, 6 and 6 rules, once each step is solved.

Check the whole part in one go, and see the board count the guard suite:

```bash
bun run verify part fence-the-agent
bun run board
```

Expect: `Part fence-the-agent is done: 5/5 steps pass.` and `Dangerous actions blocked:   30 of 30`.
