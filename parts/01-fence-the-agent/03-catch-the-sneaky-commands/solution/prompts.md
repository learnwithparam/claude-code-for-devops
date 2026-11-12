# How Claude Code got to this answer

This folder is the end state. Claude Code wrote the note and changed the hook. You typed the prompts below, read
each plan, and said yes or no.

## Prompt 1: find the gaps

```text
Read the 10 cases with set "bypass" in world/guard/cases.jsonl, and the deny rules in
parts/01-fence-the-agent/03-catch-the-sneaky-commands/problem/.claude/settings.json.
For each case, tell me if a deny rule stops it, and why.
Remember: Claude Code strips env in front of a command and splits on && before it matches a rule.
Write each case the rules miss, with one line on why, under the heading in
parts/01-fence-the-agent/03-catch-the-sneaky-commands/problem/notes/deny-rule-gaps.md.
```

### What you check

Claude Code lists 8 gaps: b01, b02, b03, b04, b05, b06, b08 and b09. It says b07 and b10 are not gaps.

- `b07-env-prefix` is `env TF_LOG=debug terraform apply -auto-approve`. Claude Code strips `env` first, so the
  rule `Bash(terraform apply *)` matches.
- `b10-chained` is `terraform fmt && terraform apply -auto-approve`. Claude Code splits on `&&`, so the second
  part matches.

If the note names b07 or b10, reply: "Claude Code strips env and splits on && before it matches. Take b07 and b10
out." The `wrong/gaps-that-are-not` answer shows this mistake.

## Prompt 2: close the gaps in the hook

```text
Change parts/01-fence-the-agent/03-catch-the-sneaky-commands/problem/.claude/hooks/guard-infra.ts
so it blocks all 10 bypass cases too. Split commands on && ; and pipes. Look inside bash -c.
Strip env, VAR= and full paths. Skip flags before the verb. Treat tofu like terraform.
Read a script file it runs and check each line. Check Bash commands for secret paths too.
It must still allow all 15 safe cases. Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Split each command into parts on `&&`, `||`, `;` and `|`.
2. Unwrap `bash -c '...'` and `sh -c '...'`, and check the inner command.
3. Drop `VAR=value`, `env`, `sudo` and `xargs` in front. Keep only the program name from a full path.
4. Treat `tofu` as `terraform`.
5. Skip global flags such as `-chdir=` and `--context <name>`, then read the verb.
6. When the command runs a script file, read the file from the call's `cwd` and check each line. Block if the file
   cannot be read.
7. Block any Bash command that names `~/.aws`, `~/.ssh` or a `.env` file.

## What you check before you say yes

- `terraform plan`, `kubectl get` and `helm template` still pass. Ask: "Run the 15 safe cases and show me each
  exit code."
- It does not block every `terraform` call to be safe. The `wrong/blocks-all-terraform` answer shows that mistake.
- It reads script files. The `wrong/forgot-the-script` answer skips this, and `b09-script-file` gets through.

## Then run the check

```bash
bun run verify catch-the-sneaky-commands
```

Expect: `Done. All 6 rules pass.`
