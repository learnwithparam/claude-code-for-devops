# How Claude Code got to this answer

This folder is the end state. Claude Code wrote the hook and changed the settings. You typed the prompts below,
read the plan, and said yes or no.

## The prompt

Start Claude Code in the root folder of the course repo, then type:

```text
Look at parts/01-fence-the-agent/02-block-the-apply/problem/.claude/hooks/guard-infra.ts
and the settings.json next to it. Turn the hook into a guard.
Test cases are in world/guard/cases.jsonl.
Block every case with set "dangerous" (exit 2, with a reason on stderr).
Allow every case with set "safe" (exit 0).
If the input is not valid JSON, block it.
Make the hook also run for the Read, Edit and Write tools, not only Bash.
Keep my deny rules. Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Read stdin and parse it as JSON inside a try block. If parsing fails, print a reason and exit 2.
2. Keep a list of dangerous patterns, each with a short reason. For example: `terraform apply`,
   `terraform destroy`, `kubectl delete`, `helm uninstall`, `aws s3 rb` and `git push --force`.
3. For a Bash call, block when the command matches a pattern.
4. For a Read, Edit or Write call, block a path that ends in `.env` or sits under `~/.aws`.
5. Otherwise exit 0.
6. In `settings.json`, change the matcher from `Bash` to `Bash|Read|Edit|Write`.

## What you check before you say yes

- The block uses `process.exit(2)`. Exit 1 is only an error, and the call still runs.
- The patterns name verbs. `terraform plan`, `kubectl get` and `helm template` must still pass.
- The deny rules from the last step are still in `settings.json`.

Then ask Claude Code to prove it:

```text
Run every case in world/guard/cases.jsonl with set dangerous or safe through the hook.
Show me a table: id, expected, exit code.
```

Every dangerous row should show exit 2, and every safe row exit 0.

## What you reject

- A hook that exits 1 to block. The `wrong/exit-one` answer shows this mistake.
- A hook that blocks every call, safe ones too. The `wrong/blocks-everything` answer shows this mistake.
- A hook that lets the call through when the JSON is broken. The `wrong/fail-open` answer shows this mistake.

## Then run the check

```bash
bun run verify block-the-apply
```

Expect: `Done. All 6 rules pass.`
