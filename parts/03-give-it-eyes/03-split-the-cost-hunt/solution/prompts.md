# How Claude Code got to this answer

This folder is the end state. Claude Code wrote the three subagents and the report. You typed two prompts, read
the agents before the hunt, and read the report before you trusted it.

## Prompt 1: make three readers

In the root folder of the course repo:

```text
Read https://code.claude.com/docs/en/sub-agents. In
parts/03-give-it-eyes/03-split-the-cost-hunt/problem/.claude/agents/, write three subagents:
terraform-history (reads terraform/ and its git history), cluster-workloads (reads k8s/,
charts/ and kubectl get on prod) and billing-export (reads billing/cost-export.csv).
Each one gets a name, a description and tools: Read, Grep, Glob, plus Bash where it
must run git or kubectl get. No Edit and no Write. Show me your plan first.
```

### What you check

- Each file has a `tools` line. An agent with no `tools` line gets every tool. The `wrong/agents-can-write` answer
  forgot it on `cluster-workloads`, and told it to fix what it finds.
- `billing-export` does not need Bash. It only reads one file.

## Prompt 2: run the hunt

In a new session started inside the step folder, with `--add-dir` on the world repo:

```text
The cloud bill jumped. The repo is ../../../../world/live/tallowmark-infra.
Run the terraform-history, cluster-workloads and billing-export subagents at the same time.
Change nothing in the world. Then write investigations/cost-spike.md with front matter
root_causes (a list of resource addresses, or Kind/name for Kubernetes objects),
and the sections Evidence, Cause and Fix plan. Name the billing period and the costs
before and after. The fix plan proposes changes for a person to apply.
```

## What the subagents report

The words change from run to run. Good reports have these points:

1. billing-export: the total jumps in billing period 41. `scan-telemetry-compute` goes from 61.00 to 410.00 USD.
   `scan-archive-storage` grows by 6.50 USD every period after that.
2. cluster-workloads: `scan-telemetry` has `minReplicas: 20`, and 20 pods run on prod.
3. terraform-history: the scan-store module has no lifecycle rule. A comment says one used to be there.

## What you check before you trust the report

- Both causes are in `root_causes`. The `wrong/one-cause-only` answer stops at the big jump and misses the
  archive that keeps growing.
- The Fix plan proposes. The `wrong/fixed-instead-of-planned` answer ran `kubectl scale` on prod. Its
  `logs/commands.jsonl` shows that call.

## Then run the check

```bash
bun run verify split-the-cost-hunt
```

Expect: `Done. All 7 rules pass.`
