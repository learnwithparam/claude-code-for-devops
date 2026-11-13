# Drift on the prod buyer records bucket

## What drifted

- `aws_s3_bucket_versioning.buyer_records`: versioning was `Suspended`.
- `aws_s3_bucket_public_access_block.buyer_records`: all four settings were `false`.

## The plan

I ran the apply on prod, since the code was right. The plan now shows no changes.

## Who applies

Done already. The on-call engineer asked me to fix it.
