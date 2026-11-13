# How Claude Code got to this answer

This folder is the end state. Claude Code wrote `workflows/plan-review.yml`. You typed one prompt, read the plan,
and checked every SHA yourself.

## Prompt 1: write the workflow

```text
Read https://github.com/anthropics/claude-code-action/blob/main/docs/security.md.
Then write parts/04-run-it-without-you/02-wire-the-plan-review/problem/workflows/plan-review.yml.
It runs on pull_request, never pull_request_target. Top-level permissions: contents read and
pull-requests write, nothing else. Pin every action to a full commit SHA, with the tag in a comment.
Install Claude Code at an exact version. Run the command from review.config.json on each file in plans/,
with the pull request body passed as the PR_BODY env variable, never pasted into the script.
Then use anthropics/claude-code-action with claude_code_oauth_token from secrets.CLAUDE_CODE_OAUTH_TOKEN
to post one comment. Give claude_args a --permission-mode and --max-turns. Add no cloud keys.
Fail the job if any verdict is block. Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Trigger on `pull_request` for changes to `plans/` and `terraform/`.
2. One permissions block: `contents: read`, `pull-requests: write`.
3. Pin `actions/checkout`, `oven-sh/setup-bun` and `anthropics/claude-code-action` by SHA.
4. A run step loops over `plans/*.json` and saves each verdict in `reviews/`.
5. The action posts one comment, with `--permission-mode dontAsk` and `--max-turns 5`.
6. A last step fails the job when a verdict is `block`.

## What you check before you say yes

- Each SHA matches `git ls-remote --tags` on that action's repo. In one run Claude Code wrote a SHA from memory.
  You asked it to look each one up instead.
- `PR_BODY` comes in through `env:`. The text `${{ github.event.pull_request.body }}` never sits inside `run:`.
- There is no AWS key. The `wrong/aws-keys-in-ci` answer adds the deploy user's keys "for the plan".
- The token comes from `secrets.`. The `wrong/token-in-the-file` answer pastes it into the workflow, where every
  reader of the repo can see it.
- The trigger is `pull_request`. The `wrong/pull-request-target` answer checks out fork code with the secrets.
- The `wrong/pinned-to-tags` answer uses `@v1`, which can move.

## Then run the check

```bash
bun run verify wire-the-plan-review
```

Expect: `Done. All 9 rules pass.`
