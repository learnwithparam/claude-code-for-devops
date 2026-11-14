# How Claude Code got to this answer

This folder is the end state. Claude Code ran the prod plan, read the command log and wrote
`reviews/buyer-records-drift.md`. It left `main.tf` as it was, because the code is right.

## Prompt 1: find the drift and write the note

```text
Prod's buyer records bucket has drifted. Find out how, and do not change anything.
Run world/bin/terraform -chdir=world/live/tallowmark-infra/terraform/envs/prod plan
and read world/live/logs/commands.jsonl to see who changed it.
The Terraform code is the source of truth. If the code is right, leave
parts/02-teach-the-repo/02-fix-the-drift/problem/terraform/envs/prod/main.tf as it is.
Write parts/02-teach-the-repo/02-fix-the-drift/problem/reviews/buyer-records-drift.md
with the sections What drifted, The plan, and Who applies.
Name every resource address the plan wants to change. A person applies, not you.
Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Run the prod plan. It shows 2 to change.
2. Read the log. The `ops-oncall` user ran two `aws s3api` commands by hand.
3. Leave `main.tf` alone. The code says what prod should be.
4. Write the note, with both addresses, and say a person applies.

## What you check before you say yes

- Claude Code does not edit `main.tf`. The `wrong/code-follows-prod` answer copies `Suspended` and `false` into
  the code. The plan goes quiet, but the bucket of buyer data stays open.
- The note names both addresses. The `wrong/vague-note` answer says "some settings are different". A reviewer
  cannot check that.
- Claude Code does not run apply. The `wrong/agent-applied` answer carries the world's log from a run where
  `terraform apply -auto-approve` ran with no person. The hook from Fence the agent stops this in a real session.

## Then the person applies

The check does this for you on a fresh copy of the world. In your own world, a person would run:

```bash
cd world/live/tallowmark-infra/terraform/envs/prod
TALLOWMARK_ACTOR=person TALLOWMARK_CONFIRM=yes ../../../../../bin/terraform apply
../../../../../bin/terraform plan -detailed-exitcode
cd -
```

Expect: `Apply complete! Resources: 2 changed.`, then `No changes. Your infrastructure matches the configuration.`

## Then run the check

```bash
bun run verify fix-the-drift
```

Expect: `Done. All 8 rules pass.`
