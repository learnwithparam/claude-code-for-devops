# Fix the drift

## The problem

Someone on call changed prod by hand. They switched off versioning and removed the public access block on the
buyer records bucket. It holds buyer names, emails and payment references. A change made outside the code is
called drift. Datadog found that at least 38 percent of organizations still do this
([State of DevSecOps](https://www.datadoghq.com/state-of-devsecops-2025/)).

## Watch it done

For example, two ways make the plan quiet. One puts prod back the way the code says. The other copies the hand change into the
code and leaves the bucket open. Only the first is a fix.

```mermaid
flowchart LR
  O[ops-oncall: aws s3api by hand] --> P[(prod bucket)]
  C[terraform/envs/prod/main.tf] --> PL[plan: 2 to change]
  P --> PL
  PL --> N[reviews/buyer-records-drift.md]
  N --> H[a person applies]
  H --> Z[plan: exit 0]
```

Before the fix the plan wants two changes. After a person applies, it exits 0.

```text
Plan: 0 to add, 2 to change, 0 to destroy.
```

## Your turn

1. Run the prod plan in your world:

```bash
bun run world reset
world/bin/terraform -chdir=world/live/tallowmark-infra/terraform/envs/prod plan -detailed-exitcode
```

Expect: `Plan: 0 to add, 2 to change, 0 to destroy.` The exit code is 2, which means "there are changes".

2. Start Claude Code in the root folder of this course repo, and give it this job:

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

   Expect: a plan first, and no edit to `main.tf`. Say no if it wants to write `Suspended`.
3. Read the note it writes. Expect: both resource addresses, word for word.

## Do it on your work

Run your own plan, and ask for the same note. Good looks like each drifted address named, and the apply left to a person.

## Done when

- The note has What drifted, The plan and Who applies.
- What drifted names `aws_s3_bucket_versioning.buyer_records` and
  `aws_s3_bucket_public_access_block.buyer_records`.
- After a person applies, the prod plan shows no changes, and the bucket is locked again.
- Nothing changed the world without a person.

```bash
bun run verify fix-the-drift
```

Expect: `Done. All 8 rules pass.`

![The drift check passing on the sample answer](../images/expected.png)

## Solution

See `../solution/`. The diff adds `reviews/buyer-records-drift.md` and leaves `main.tf` as it was. The
prompts are in `../solution/prompts.md`. Read them after you try.

## If you get stuck

| What you see | What to ask Claude Code |
|---|---|
| `FAIL What drifted names both drifted resource addresses` | "Copy each address from the plan output into What drifted, word for word." |
| `FAIL prod's buyer records keep versioning on ...` | "Undo your change to main.tf. The code is right. Prod is wrong." |
| `FAIL nothing changed the world without a person` | Nothing to ask. Run `bun run world reset`, and say no to any apply. |

## Words you will use

- **Drift**: the cloud no longer matches the code, because someone changed it by hand.
- **Source of truth**: the one place that says how things should be. Here it is the Terraform code.
- **`-detailed-exitcode`**: makes `plan` exit 0 for no changes, and 2 for changes.
