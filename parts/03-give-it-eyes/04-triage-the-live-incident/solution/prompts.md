# How Claude Code got to this answer

This folder is the end state. You gave Claude Code eyes on prod and no hands.

## Prompt 1: fence first

```text
In .claude/settings.json allow only read commands on the cluster: kubectl get, describe and logs, and helm history.
Deny every kubectl and helm command that changes anything: apply, delete, rollout, scale, patch, edit, exec,
helm rollback and helm upgrade. Show me the file before you save it.
```

## Prompt 2: triage

```text
seat-api in prod is crash looping. Use only read commands with --context kind-tallowmark-prod.
Fill incident/triage.md. Put the commands you ran under Evidence. Say what you think caused it, and say it is a guess.
Under Rollback, write the command, but name a person to run it.
```

## What you check before you say yes

- Every command under Evidence is a read.
- The rollback names a person, and Claude Code does not run it.

## Prompt 3: watch it

```text
Under Watch it, write one /loop line that only reads the seat pods on prod every few minutes, and say when to stop.
```
