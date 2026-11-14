# How Claude Code got to this answer

This folder is the end state. Claude Code made `kit/`: the settings, the hook, the managed settings and the
README. You typed one prompt and edited the README with Claude Code until it claimed no more than the test proves.

## Prompt 1: package the kit

```text
In parts/05-ship-the-kit/02-ship-the-guardrail-kit/problem/, make a kit/ folder for another team.
Copy .claude/settings.json to kit/settings.json, .claude/hooks/ to kit/hooks/, and
.devcontainer/managed-settings.json to kit/managed-settings.json.
The hook path must use $CLAUDE_PROJECT_DIR, never a path on this machine.
Then write kit/README.md for a security reviewer, with three sections:
What it blocks, What it does not block, How to test it.
Read world/guard/cases.jsonl for What it blocks. In What it does not block, be honest:
include subprocesses a program starts and scripts the hook cannot read. Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Copy the three files and the hooks folder. Keep `$CLAUDE_PROJECT_DIR` in the hook command.
2. Group the 45 cases in What it blocks: Terraform, kubectl and Helm, AWS, git, secrets, the 10 bypass forms.
3. List the limits: subprocesses, scripts it cannot read, code run later, renamed programs, a person.
4. Point How to test it at `bun run verify ship-the-guardrail-kit`.

## What you push back on

The first README said the kit "makes prod safe". You said:

```text
Remove "makes prod safe". Say what the test proves, and nothing more.
```

## What you check before you say yes

- The hooks folder is in the kit. The `wrong/missing-hook` answer ships settings only, so the hook command fails
  and Claude Code runs the call anyway.
- What it does not block is there. The `wrong/readme-only-strengths` answer drops it and says the kit "fully
  stops" Claude Code.

## Then run the check

```bash
bun run verify ship-the-guardrail-kit
```

Expect: `Done. All 8 rules pass.`
