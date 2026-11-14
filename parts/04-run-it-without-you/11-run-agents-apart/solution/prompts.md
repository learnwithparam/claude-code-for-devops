# How Claude Code got to this answer

This folder is the end state. Three agents work at once, each in its own worktree, and none can touch another's files.

## Prompt 1: split the work

```text
Split these three jobs so no file belongs to two of them: pin the actions in workflows/ci.yml, add limits in
charts/seat-api/values.yaml, tag the buckets in terraform/modules/scan-store. Write batch.md with a /batch line and
a table of units and the paths each may change.
```

## Prompt 2: start them

```text
Write scripts/start-agents.sh. It starts one claude -w per unit, with a different name each, in print mode with a
permission mode and a turn limit, then waits. Also write a merge-reviewer subagent that can read but not edit.
```

## What you check before you say yes

- No path is in two units.
- Every agent has a different worktree name.
- The reviewer cannot edit.
