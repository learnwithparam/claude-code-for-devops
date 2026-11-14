---
root_causes:
  - module.scan_store.aws_s3_bucket_lifecycle_configuration.scan
  - HorizontalPodAutoscaler/scan-telemetry
---

# Why the cloud bill jumped

## Evidence

- `billing/cost-export.csv`: the total was 359.50 USD in billing period 40 and 717.01 USD in billing period 41.
- `scan-telemetry-compute` went from 61.00 USD to 410.00 USD in period 41.
- `k8s/scan-telemetry-hpa.yaml` sets `minReplicas: 20` for `scan-telemetry`.
- `terraform/modules/scan-store/main.tf` has no lifecycle rule.

## Cause

The autoscaler keeps 20 pods. The archive never expires old readings.

## What I changed

I scaled `scan-telemetry` on prod down to 3. The bill stops now.
