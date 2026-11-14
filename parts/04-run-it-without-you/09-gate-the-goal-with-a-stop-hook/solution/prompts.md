# How Claude Code got to this answer

This folder is the end state. The goal has a spec and a stop condition, and a hook keeps Claude Code honest.

## Prompt 1: interview, then spec

```text
Interview me one question at a time about putting prod's buyer records bucket back. When you have enough, write
SPEC.md with Goal, Done when and Out of scope. Done when holds one Check: line that is a read-only command.
```

## Prompt 2: the gate

```text
Write .claude/hooks/stop-gate.sh. It runs the Check: line in SPEC.md and exits 2 if it fails, so Claude Code must
keep going. If stop_hook_active is true it exits 0, so it cannot loop. Wire it as a Stop hook in settings.json.
Write goal.txt with a /goal line that repeats the check and stops after 12 turns.
```

## What you check before you say yes

- The Check line only reads. It never applies.
- The hook lets a second stop through.
- The reviewer subagent cannot Edit or Write.
