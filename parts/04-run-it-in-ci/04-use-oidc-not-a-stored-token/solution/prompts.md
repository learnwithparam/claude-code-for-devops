# How Claude Code got to this answer

This folder is the end state. The job asks AWS for a short-lived token, so no key is stored.

## Prompt 1: swap the keys for a role

```text
In workflows/plan.yml remove the AWS key secrets. Give the job permissions contents read and id-token write.
Add aws-actions/configure-aws-credentials with role-to-assume tallowmark-plan-readonly, pinned by a full commit SHA.
The job only plans. It never applies. Show me the diff first.
```

## What you check before you say yes

- No `secrets.AWS` line is left.
- Every `uses:` has a 40 character SHA.
- The job has no apply.
