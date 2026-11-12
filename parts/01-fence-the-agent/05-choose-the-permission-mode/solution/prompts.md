# How Claude Code got to this answer

This folder is the end state. Claude Code filled in the note and changed `settings.json`. You typed the prompts
below, read each plan, and made the one real choice: the mode.

## Prompt 1: learn the modes

```text
Read https://code.claude.com/docs/en/permission-modes.
Then fill in the table in
parts/01-fence-the-agent/05-choose-the-permission-mode/problem/notes/permission-mode.md.
For each mode (default, acceptEdits, plan, auto, dontAsk), say what it does,
and when I would use it on tallowmark-infra, where the shell starts on prod.
Do not fill in the Mode: line yet.
```

### What you check

Each row has text in both cells. The rows should say something like this:

- `default` asks before each new tool. Use it for normal sessions.
- `acceptEdits` accepts file edits without asking. Use it on a branch, never with prod keys loaded.
- `plan` reads and edits nothing. Use it to look into drift before you decide.
- `auto` lets a classifier say yes. Not on this repo.
- `dontAsk` denies anything that would ask. Use it for headless runs in CI.

## Prompt 2: set the mode

You picked `default`. Then you typed:

```text
In the same note, under "## This repo", write "Mode: default".
In parts/01-fence-the-agent/05-choose-the-permission-mode/problem/.claude/settings.json,
set permissions.defaultMode to "default", and set
permissions.disableBypassPermissionsMode to "disable".
Keep the hook and the sandbox as they are. Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Add `Mode: default` under `## This repo` in the note.
2. Add `"defaultMode": "default"` and `"disableBypassPermissionsMode": "disable"` to `permissions`.
3. Change nothing else.

## What you check before you say yes

- The mode in the note and the mode in the settings are the same word.
- The mode is not `auto`. The `wrong/auto-by-default` answer shows this mistake.
- Bypass mode is switched off. The `wrong/bypass-left-open` answer forgets this.

## Then run the check

```bash
bun run verify choose-the-permission-mode
```

Expect: `Done. All 6 rules pass.`
