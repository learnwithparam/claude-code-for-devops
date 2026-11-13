# Buyer records bucket drift (prod)

Environment: **prod** (`tallowmark-prod-buyer-records`, eu-west-2)
Plan run: 2026-11-12, `terraform -chdir=terraform/envs/prod plan -detailed-exitcode` → exit code **2** (changes pending)

## What drifted

Someone changed the live bucket so it no longer matches `terraform/envs/prod/main.tf`. This bucket holds buyer names,
emails and payment references, and the code says it must never be public.

| Resource address | Live (drifted) | Code says |
|---|---|---|
| `aws_s3_bucket_public_access_block.buyer_records` | `block_public_acls = false` | `true` |
| | `block_public_policy = false` | `true` |
| | `ignore_public_acls = false` | `true` |
| | `restrict_public_buckets = false` | `true` |
| `aws_s3_bucket_versioning.buyer_records` | `status = "Suspended"` | `"Enabled"` |

All four public access block settings are off, so nothing at the bucket level stops a public ACL or bucket policy from
exposing buyer data. With versioning suspended, any object overwritten or deleted from now on can't be recovered.

Nothing else in prod drifted. `aws_s3_bucket.buyer_records` and `module.scan_store` show no changes.

## The plan

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

Resource addresses the prod plan wants to change:

1. `aws_s3_bucket_public_access_block.buyer_records`: update in place
2. `aws_s3_bucket_versioning.buyer_records`: update in place

No Terraform code changes are needed. The code is already correct, and applying it puts the bucket back.

Before applying, the reviewer should check:

- **Find out who turned these off and why.** If something now depends on public access, such as a public policy or
  object ACLs, turning the block back on will cut that access off. Turning it back on is still the correct state for
  this data.
- **Check for exposure while the block was off.** Look at the bucket policy, object ACLs and CloudTrail/S3 access logs
  for public reads. If buyer data was readable, this may be a reportable incident.
- Objects written while versioning was suspended have a `null` version ID. Re-enabling versioning does not bring back
  anything overwritten or deleted in that window.

## Who applies

A person applies, not Claude. Under the repo rules, Claude does not run `apply`, `destroy` or `delete`, and a hook
blocks it from doing so. A prod-authorised engineer should:

```
terraform -chdir=terraform/envs/prod plan -out=buyer-records.tfplan
# check that it shows only the two addresses above
terraform -chdir=terraform/envs/prod apply buyer-records.tfplan
terraform -chdir=terraform/envs/prod plan -detailed-exitcode   # expect exit 0
```

This is done when the final plan exits 0.
