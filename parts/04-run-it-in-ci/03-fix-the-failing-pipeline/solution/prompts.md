# How Claude Code got to this answer

This folder is the end state. Claude Code changed `workflows/ci.yml` and the scan-store module. You typed one
prompt, read the cause it found, and checked the plan.

## Prompt 1: find the cause, then fix it

```text
CI fails for parts/04-run-it-in-ci/03-fix-the-failing-pipeline/problem/workflows/ci.yml.
Read it, the module terraform/modules/scan-store/main.tf next to it, and
world/seed/tallowmark-infra/.tflint.hcl. Tell me why it fails before you change anything.
Then fix the cause: pin every action to a full commit SHA, looked up with git ls-remote --tags,
with the tag in a comment. Give the module a terraform block with required_version and
required_providers, the same as terraform/envs/dev. Keep the tflint step. Add no resources.
Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. The cause: `.tflint.hcl` turns on `terraform_required_providers` and `terraform_required_version`, and the
   module has neither.
2. The cause: `actions/checkout@v4`, `setup-terraform@v3` and `setup-tflint@main` can all move.
3. Look up the current SHA of each action with `git ls-remote --tags`.
4. Add the terraform block to the module. Change nothing else in it.

## What you check before you say yes

- The `tflint` step stays. The `wrong/removed-the-lint` answer deletes it and leaves the module as it was.
- Each `uses:` ends in 40 characters, not a tag. The `wrong/pinned-to-tags` answer only updates the tags.
- No lifecycle rule or other resource appears in the module.

## Then run the check

```bash
bun run verify fix-the-failing-pipeline
```

Expect: `Done. All 5 rules pass.`
