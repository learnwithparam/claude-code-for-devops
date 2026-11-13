# How Claude Code got to this answer

This folder is the end state. Claude Code read the world repo and wrote `CLAUDE.md` and
`.claude/rules/terraform.md`. You typed two prompts and cut what did not belong.

## Prompt 1: write the memory

```text
Read world/seed/tallowmark-infra: its README, .envrc, terraform/, charts/ and alerts/.
Then write parts/02-teach-the-repo/01-write-the-repo-memory/problem/CLAUDE.md for that repo.
Use exactly four sections: Environments, Commands, Never, Done means.
Say that the shell starts on prod. List only commands that read, never apply.
Done means: terraform plan -detailed-exitcode exits 0 after a person applies.
Keep it under 60 lines. Show me the file before you save it.
```

## Prompt 2: move the Terraform advice to a rule

```text
Move the Terraform-only advice into
parts/02-teach-the-repo/01-write-the-repo-memory/problem/.claude/rules/terraform.md,
with front matter paths: ["terraform/**/*.tf"].
Say the code is the source of truth, and that the buyer records bucket keeps
versioning on and all four public access settings true.
Do not touch .claude/settings.json or the hook.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Read `.envrc` and see that it sets `TALLOWMARK_ENV=prod`.
2. Write four short sections. Commands are plan, lint, template and get.
3. Put the Terraform rules in their own file, scoped with `paths:`.
4. Leave `settings.json` and the hook alone.

## What you check before you say yes

- The file is short. The `wrong/wall-of-rules` answer has 202 lines of "check X on Y" that Claude Code reads
  but does not follow well.
- The Never section says the hook is the guard. The `wrong/memory-instead-of-hook` answer writes
  "NEVER run terraform apply. This rule is mandatory." and drops the hook. The check runs 45 planted calls and
  that answer lets every dangerous one through.
- The pattern is `terraform/**/*.tf`. The `wrong/rule-never-loads` answer uses `terraform/*.tf`, which matches
  no file, because the code sits in `terraform/envs/prod/`.

## Then run the check

```bash
bun run verify write-the-repo-memory
```

Expect: `Done. All 8 rules pass.`
