# How Claude Code got to this answer

This folder is the end state. A scheduled check looks for drift and stays quiet when there is none.

## Prompt 1: write the routine

```text
In routines/drift-check.toml write a scheduled drift check for prod. Run it on weekday mornings, not more often than
once an hour. It plans with -detailed-exitcode and never applies. Only plan and show are allowed. It tells a person
only when there is drift, and stays quiet otherwise. Show me the file first.
```

## What you check before you say yes

- No allowed tool can change prod.
- The owner is a person or a team.
- It says nothing when nothing drifted.

## Prompt 2: the run contract

```text
Add a contract table: a turn limit, what a failed run does, and a .jsonl log file.
```
