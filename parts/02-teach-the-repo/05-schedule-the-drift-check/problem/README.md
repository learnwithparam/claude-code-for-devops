# Schedule the drift check

## The problem

In the last step, someone found drift by hand. Drift is when the real cloud no longer matches the code. Nobody
looks until something breaks. A scheduled check looks every morning. It must only read, and it must stay quiet when
all is well, or people stop reading it.

```mermaid
flowchart LR
  T[Weekday 07:00] --> P[terraform plan, read only]
  P -->|exit 0| Q[Stay quiet]
  P -->|exit 2| N[Note and tell the on-call engineer]
  N --> H[A person applies]
```

## Your challenge

Start Claude Code in the root folder of this course repo, and give it this job:

```text
In parts/02-teach-the-repo/05-schedule-the-drift-check/problem/routines/drift-check.toml fill every field.
Run on weekday mornings, never more often than once an hour. The prompt runs terraform plan with -detailed-exitcode
on prod, names each drifted address, and never applies. Allow only plan, show, Read and writes to reviews/.
Tell a person only when there is drift. Name the owner. Show me the file first.
```

Read the file. Could any allowed tool change prod?

The prompts that solve this step are in `../solution/prompts.md`. Read them after you try.

## Done when

- The schedule is five fields and runs at most once an hour.
- The prompt plans with `-detailed-exitcode` and says never to apply.
- No allowed tool applies, destroys or imports.
- It notifies only on drift, and names an owner.

```bash
bun run verify schedule-the-drift-check
```

Expect: `Done. All 6 rules pass.`

## If you get stuck

| What you see | What to ask Claude Code |
|---|---|
| `FAIL the schedule runs at most once an hour` | "Use a fixed minute and hour, such as 0 7 * * 1-5." |
| `FAIL no allowed tool changes anything` | "Remove apply from allowed_tools. Keep plan and show." |

## Words you will use

- **Drift**: the real cloud differs from the code.
- **Cron**: five fields, minute hour day month weekday, that say when a job runs.
