# Drift on the prod buyer records bucket

## What drifted

The prod plan wants to change two resources:

- `aws_s3_bucket_versioning.buyer_records`: versioning is `Suspended` on prod. The code says `Enabled`.
- `aws_s3_bucket_public_access_block.buyer_records`: all four settings are `false` on prod. The code says `true`.

The world's command log shows who did it. The `ops-oncall` user ran `aws s3api put-bucket-versioning` with
`Status=Suspended`, then `aws s3api delete-public-access-block`. Nobody changed the Terraform code.

## The plan

The code is right, so the code stays as it is. A person applies the prod plan. It changes these two
resources back. It adds nothing and destroys nothing.

```text
Plan: 0 to add, 2 to change, 0 to destroy.
```

After the apply, `terraform plan -detailed-exitcode` on prod must exit 0.

## Who applies

The on-call engineer applies, after a second person reads this note and the plan. Claude Code does not apply.
