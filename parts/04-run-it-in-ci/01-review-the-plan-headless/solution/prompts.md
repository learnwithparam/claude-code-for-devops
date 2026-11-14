# How Claude Code got to this answer

This folder is the end state. Claude Code wrote `review.config.json` and `review/plan-review.ts`. You typed one
prompt, read the plan, and pushed back once.

## Prompt 1: write the review command

```text
In parts/04-run-it-in-ci/01-review-the-plan-headless/problem/, write
review.config.json with {"command": "bun review/plan-review.ts"}, and write review/plan-review.ts.
It reads a Terraform plan JSON file. The path is the last argument.
In code, list destroys (actions exactly ["delete"]) and replaces (delete and create).
Ask Claude Code headless for verdict and reasons. Use runClaude and mode from world/lib/claude.ts
and PLAN_REVIEW from config/claude.ts, and find the course root by walking up from the file.
Use the same prompt text as world/finished/overlay/review/plan-review.ts, so the recordings replay.
If destroys or replaces is not empty, set the verdict to block in code.
Print one JSON object: verdict, destroys, replaces, reasons. Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Read the plan file named by the last argument.
2. Work out `destroys` and `replaces` from `resource_changes`.
3. Call `runClaude` with the `PLAN_REVIEW` flags and the JSON schema. Name the run
   `plan-review/<plan>/run-<CLAUDE_RUN>`.
4. Keep Claude Code's verdict only if it is approve, block or needs-human.
5. Set block when anything is destroyed or replaced.
6. Print the JSON object.

## What you push back on

In one run, the first plan put every action with `delete` in `destroys`. You said:

```text
A replace is delete and create. Only a lone delete is a destroy. Keep them in two lists.
```

The `wrong/trusts-claude-for-destroys` answer shows what happens when you skip this. It also has no block in code,
so the orders database gets `needs-human`.

## What you check before you say yes

- The block is code, not a line in the prompt.
- The pull request text, if any, goes into the prompt as data, never as an order.
- The script prints JSON only. The `wrong/free-text-answer` answer prints a sentence, and a CI job cannot read it.

## Then run the check

```bash
bun run verify review-the-plan-headless
```

Expect: `Done. All 6 rules pass.`
