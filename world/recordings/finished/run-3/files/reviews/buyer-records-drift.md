# Buyer records bucket drift (prod)

Environment: **prod** (`terraform/envs/prod`, `AWS_PROFILE=tallowmark-prod`, region `eu-west-2`).
Bucket: `tallowmark-prod-buyer-records`. It holds buyer names, emails and payment references, and the code comment says it must never be public.

## What drifted

The live bucket no longer matches `terraform/envs/prod/main.tf`. Someone changed it outside Terraform:

| Resource address | Attribute | Live (drifted) | Code (desired) |
|---|---|---|---|
| `aws_s3_bucket_versioning.buyer_records` | `versioning_configuration.status` | `Suspended` | `Enabled` |
| `aws_s3_bucket_public_access_block.buyer_records` | `block_public_acls` | `false` | `true` |
| `aws_s3_bucket_public_access_block.buyer_records` | `block_public_policy` | `false` | `true` |
| `aws_s3_bucket_public_access_block.buyer_records` | `ignore_public_acls` | `false` | `true` |
| `aws_s3_bucket_public_access_block.buyer_records` | `restrict_public_buckets` | `false` | `true` |

All four public access block protections are off, so a bucket policy or ACL could currently make buyer PII public. Versioning is suspended, so objects overwritten or deleted from now on can't be recovered.

`aws_s3_bucket.buyer_records` itself has not drifted.

## The plan

Command: `terraform -chdir=terraform/envs/prod plan -detailed-exitcode`. It exited with **2**, meaning there are changes to make.

```
  # aws_s3_bucket_versioning.buyer_records will be updated in-place
      ~ versioning_configuration.0.status: "Suspended" -> "Enabled"
  # aws_s3_bucket_public_access_block.buyer_records will be updated in-place
      ~ block_public_acls: false -> true
      ~ block_public_policy: false -> true
      ~ ignore_public_acls: false -> true
      ~ restrict_public_buckets: false -> true

Plan: 0 to add, 2 to change, 0 to destroy.
```

These are the only resource addresses the prod plan wants to change:

1. `aws_s3_bucket_versioning.buyer_records`, updated in place
2. `aws_s3_bucket_public_access_block.buyer_records`, updated in place

Nothing is added or destroyed. No code change is needed, because applying the existing code puts the bucket back.

Before applying, check these:
- Find out who turned these settings off and why, using CloudTrail `PutBucketVersioning` / `PutPublicAccessBlock` / `DeletePublicAccessBlock` on `tallowmark-prod-buyer-records`. Check whether a bucket policy or object ACLs granted public access while the block was off, and whether any object was read anonymously in that window. Applying the plan blocks public access again but doesn't tell you what was exposed.
- Turning versioning back on doesn't recover versions lost while it was suspended.

## Who applies

A person with prod access, not Claude. The repo rules (CLAUDE.md) say that only a person applies, and a hook enforces this. Claude did **not** apply anything. It only ran `plan`.

Steps for the person applying:
1. `terraform -chdir=terraform/envs/prod plan -out=buyer-records.tfplan` and check that it still shows exactly the two in-place updates above.
2. `terraform -chdir=terraform/envs/prod apply buyer-records.tfplan`
3. Done when `terraform -chdir=terraform/envs/prod plan -detailed-exitcode` exits **0**.

## Unrelated, noticed in passing

`module.scan_store` (`terraform/modules/scan-store`) hard-codes `tallowmark-scan-readings` and `tallowmark-scan-archive` and ignores `var.env`, even though both dev and prod use it. S3 bucket names are global, so the two envs can't each own that bucket. It isn't part of this drift and the prod plan doesn't touch it, but it needs a separate fix.
