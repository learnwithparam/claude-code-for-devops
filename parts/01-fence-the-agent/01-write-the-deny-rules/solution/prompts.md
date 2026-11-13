# How Claude Code got to this answer

This folder is the end state. Claude Code wrote every file in it. You typed the prompts below, read the plan, and
said yes or no.

## The prompt

Start Claude Code in the root folder of the course repo, then type:

```text
Open parts/01-fence-the-agent/01-write-the-deny-rules/problem/.claude/settings.json.
Add deny rules so you can never run these without a person:
terraform apply, terraform destroy, kubectl delete and helm uninstall.
Also deny reading .env in any folder of the repo, and anything under ~/.aws.
Keep every allow rule that is there now. Show me your plan before you change the file.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Keep the six allow rules as they are.
2. Add six rules to `permissions.deny`:
   `Bash(terraform apply *)`, `Bash(terraform destroy *)`, `Bash(kubectl delete *)`,
   `Bash(helm uninstall *)`, `Read(**/.env)` and `Read(~/.aws/**)`.
3. Keep the file valid JSON.

## What you check before you say yes

- Every Bash rule names the verb, not only the program. For example, `Bash(terraform *)` in deny also blocks
  `terraform plan`. Say no to that plan.
- The `.env` rule starts with `**/`. If the plan says `Read(.env)`, reply: "Use `Read(**/.env)` so it covers
  every folder."
- The AWS rule starts with `~/`. If the plan says `Read(/.aws/**)`, that means the project folder, not your home.
- No allow rule was removed.

## What you reject

- A plan that puts the rules in `CLAUDE.md` as words. Claude Code reads `CLAUDE.md` as advice, not as a rule.
  The `wrong/prompt-only` answer shows this mistake.
- A plan that denies only `terraform apply`. The `wrong/apply-only` answer shows this mistake.

## Then run the check

```bash
bun run verify write-the-deny-rules
```

Expect: `Done. All 8 rules pass.`
