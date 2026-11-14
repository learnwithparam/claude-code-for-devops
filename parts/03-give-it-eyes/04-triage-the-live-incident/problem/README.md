# Triage the live incident

## The problem

At 2am the checkout page fails. The on-call engineer is tired, and prod is on fire. An agent with write access can make it worse in one command. For example, the Knight Capital outage lost 440 million dollars in under an hour from an unchecked deploy ([SEC order](https://www.sec.gov/litigation/admin/2013/34-70694.pdf)).

## Watch it done

```mermaid
flowchart LR
  A[Alert: checkout errors] --> R[Claude Code reads pods and logs]
  R --> N[incident/triage.md]
  N --> P{On-call engineer}
  P -->|decides| B[helm rollback, run by a person]
```

Claude Code gets eyes and no hands. It reads pods and logs and writes a short note. A person decides on the rollback. The note on the sample answer lists only reads:

```text
kubectl get pods -n seat --context kind-tallowmark-prod
kubectl describe pod seat-api-10x7 -n seat --context kind-tallowmark-prod
kubectl logs seat-api-10x7 -n seat --previous --context kind-tallowmark-prod
```

## Your turn

1. Start Claude Code in the root folder of this course repo. Give it this job:

```text
In parts/03-give-it-eyes/04-triage-the-live-incident/problem/.claude/settings.json allow only read commands:
kubectl get, describe and logs, and helm history. Deny every command that changes the cluster, including
helm rollback. Then fill incident/triage.md for the seat-api crash loop on prod. Use only read commands with
--context kind-tallowmark-prod, and list them under Evidence. Say the cause is a guess. Under Rollback, write the
command but name a person to run it. Add a Watch it section with a /loop line that only reads, and say when to stop. Show me your plan first.
```

Expect: a plan. Is any write command in the allow list? Does the note name a person?

2. Read the note. Does it say the cause is a guess?

Expect: yes, and the rollback names a person, not Claude Code.

## Do it on your work

Take one past incident from your own notes. Mark each command you ran as read or write. Allow only the reads, deny the rest, and name a person for any fix. Good looks like an allow list with no write command.

## Done when

- The settings deny every command that changes the cluster, and allow none.
- The note has the four sections: What I saw, Evidence, Likely cause, Rollback.
- Evidence holds at least two read commands that name the prod context.
- The rollback names a person and is not run by Claude Code.
- Watch it holds a read-only `/loop` with an interval, and says when to stop.

```bash
bun run verify triage-the-live-incident
```

Expect: `Done. All 8 rules pass.`

## Solution

The after state is in `../solution/`. It adds the allow and deny rules in `.claude/settings.json` and the finished `incident/triage.md`. Prompts: `../solution/prompts.md`.

## If you get stuck

| What you see | What to ask Claude Code |
|---|---|
| `FAIL the settings deny every write command` | "Add deny rules for apply, delete, rollout, scale, patch, edit, exec, helm rollback and helm upgrade." |
| `FAIL Evidence holds at least two read commands` | "Run the reads and paste each command under Evidence." |
| `FAIL the rollback names a person` | "Say that the on-call engineer runs the rollback, not you." |

## Words you will use

- **Triage**: a fast look to find what is wrong and what to do first.
- **Read-only**: it can look and cannot change anything.
- **Rollback**: go back to the last release that worked.
