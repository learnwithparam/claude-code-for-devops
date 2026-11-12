# Buyer records bucket drift (prod)

Environment: **prod** (`TALLOWMARK_ENV=prod`, AWS profile `tallowmark-prod`, region `eu-west-2`).
Bucket: `tallowmark-prod-buyer-records`. It holds buyer names, emails and payment references, and must never be public.

## What drifted

Someone changed the live bucket outside Terraform, so it no longer matches `terraform/envs/prod/main.tf`:

| Resource address | Attribute | Live (drifted) | Code (desired) |
|---|---|---|---|
| `aws_s3_bucket_versioning.buyer_records` | `versioning_configuration.status` | `Suspended` | `Enabled` |
| `aws_s3_bucket_public_access_block.buyer_records` | `block_public_acls` | `false` | `true` |
| `aws_s3_bucket_public_access_block.buyer_records` | `block_public_policy` | `false` | `true` |
| `aws_s3_bucket_public_access_block.buyer_records` | `ignore_public_acls` | `false` | `true` |
| `aws_s3_bucket_public_access_block.buyer_records` | `restrict_public_buckets` | `false` | `true` |

Impact: every public access guard is off, so a public ACL or bucket policy would expose buyer PII. With versioning
suspended, overwrites and deletes since the change cannot be recovered.

No other resource in prod drifted. `aws_s3_bucket.buyer_records` and `module.scan_store` show no changes.

## The plan

Command (read-only, run on prod):

```
terraform -chdir=terraform/envs/prod plan -detailed-exitcode
```

Exit code: **2** (changes present).

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

Resource addresses the prod plan wants to change (all of them):

1. `aws_s3_bucket_versioning.buyer_records`: update in place
2. `aws_s3_bucket_public_access_block.buyer_records`: update in place

Nothing is created or destroyed. No code change is needed because the code is already correct. Applying it reverts
the console change.

Before applying:
- Find out who turned these settings off and why (CloudTrail `PutBucketVersioning` / `PutPublicAccessBlock` on
  `tallowmark-prod-buyer-records`). If someone still depends on public access, it should be served another way, not by
  leaving PII public.
- Check whether a bucket policy or object ACLs granting public access were added while the block was off. Terraform
  does not manage those here, so this plan will not show them, but `restrict_public_buckets`/`ignore_public_acls`
  will neutralise them once applied.
- Consider rotating or notifying under your incident process if access logs show anonymous reads.

## Who applies

A person with prod access applies. Claude does not: the repo rules forbid apply/destroy/delete, and a hook blocks it.

Steps for the human applier:

```
terraform -chdir=terraform/envs/prod plan -out=buyer-records.tfplan
# confirm it shows only the 2 addresses above, 0 add / 0 destroy
terraform -chdir=terraform/envs/prod apply buyer-records.tfplan
terraform -chdir=terraform/envs/prod plan -detailed-exitcode   # must exit 0
```

Done means the final `plan -detailed-exitcode` exits 0 on prod.
