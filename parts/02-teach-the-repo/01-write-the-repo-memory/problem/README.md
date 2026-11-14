# Write the repo memory

## The problem

Each Claude Code session starts with an empty memory. It does not know that your shell starts on prod. It does
not know that `plan` is the judge of done. People report that it even skips "mandatory" rules in `CLAUDE.md`
([issue #2544](https://github.com/anthropics/claude-code/issues/2544)). So memory advises, and the hook still guards.

## Watch it done

For example, `CLAUDE.md` loads every session. A rule file in `.claude/rules/` loads only for a matching file.

```mermaid
flowchart LR
  S[Session starts] --> M[CLAUDE.md: always loaded]
  O[Claude Code opens terraform/envs/prod/main.tf] --> R[.claude/rules/terraform.md loads]
  M --> A[Claude Code works]
  R --> A
  A --> H{guard hook}
  H -->|apply| X[Blocked]
```

The check on the sample answer ends like this:

```text
Done. All 8 rules pass.
```

## Your turn

1. Start Claude Code in the root folder of this course repo. Type `/init`. Expect: a first `CLAUDE.md` draft.
2. Give it this job:

   ```text
   Read world/seed/tallowmark-infra: its README, .envrc, terraform/, charts/ and alerts/.
   Then write parts/02-teach-the-repo/01-write-the-repo-memory/problem/CLAUDE.md for that repo.
   Use exactly four sections: Environments, Commands, Never, Done means.
   Say that the shell starts on prod. List only commands that read, never apply.
   Done means: terraform plan -detailed-exitcode exits 0 after a person applies.
   Keep it under 60 lines. Show me the file before you save it.
   ```

   Expect: a file with four sections, shown before it is saved.
3. Cut every line that Claude Code does not need in every session. Expect: a shorter file.
4. Give the second job:

   ```text
   Move the Terraform-only advice into
   parts/02-teach-the-repo/01-write-the-repo-memory/problem/.claude/rules/terraform.md,
   with front matter paths: ["terraform/**/*.tf"].
   Say the code is the source of truth, and that the buyer records bucket keeps
   versioning on and all four public access settings true.
   Do not touch .claude/settings.json or the hook.
   ```

   Expect: a rule file, and an untouched hook.

## Do it on your work

Run the same two jobs in your own repo, and list only read commands. Good looks like a short `CLAUDE.md`
and one rule file per area.

## Done when

- `CLAUDE.md` is under 200 lines, with the sections Environments, Commands, Never and Done means.
- The Commands section has no apply, destroy or delete.
- Done means names `terraform plan -detailed-exitcode`.
- `.claude/rules/terraform.md` loads for `terraform/envs/prod/main.tf`, and not for the Helm chart.
- The guard hook from Fence the agent still blocks 30 of 30 and allows 15 of 15.

```bash
bun run verify write-the-repo-memory
```

Expect: `Done. All 8 rules pass.`

![The memory check passing on the sample answer](../images/expected.png)

## Solution

See `../solution/`. The diff adds `CLAUDE.md` with four sections and a Terraform-only rule file. The prompts
are in `../solution/prompts.md`. Read them after you try.

## If you get stuck

| What you see | What to ask Claude Code |
|---|---|
| `FAIL CLAUDE.md exists and is under 200 lines` | "Cut every line that is not needed in every session. Move Terraform detail to the rule file." |
| `FAIL .claude/rules/terraform.md has paths: ...` | "Use `terraform/**/*.tf`. The pattern `terraform/*.tf` only matches files directly in terraform/." |
| `FAIL the guard hook from Fence the agent still blocks 30 of 30 ...` | "Put back the hooks block in settings.json and the file .claude/hooks/guard-infra.ts." |

## Words you will use

- **Memory**: `CLAUDE.md`, the text Claude Code reads at the start of each session.
- **Path-scoped rule**: a file in `.claude/rules/` with `paths:` at the top. It loads only for matching files.
- **Front matter**: the lines between two `---` lines at the top of a Markdown file.
