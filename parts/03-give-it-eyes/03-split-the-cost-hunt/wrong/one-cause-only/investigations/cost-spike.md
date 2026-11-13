---
root_causes:
  - HorizontalPodAutoscaler/scan-telemetry
---

# Why the cloud bill jumped

## Evidence

- `billing/cost-export.csv`: the total was 359.50 USD in billing period 40 and 717.01 USD in billing period 41.
- `scan-telemetry-compute` went from 61.00 USD in period 40 to 410.00 USD in period 41. It stays at 410.00.
- `scan-archive-storage` went from 18.00 USD in period 40 to 24.50 USD in period 41. It grows by 6.50 USD each
  period, up to 148.00 USD in period 60.
- `k8s/scan-telemetry-hpa.yaml` sets `minReplicas: 20` for `scan-telemetry`. `kubectl get pods -n scan` on prod
  shows 20 pods, with no show running.
- `terraform/modules/scan-store/main.tf` has no `aws_s3_bucket_lifecycle_configuration`. A comment says the
  lifecycle rule used to live there.

## Cause

One change landed in billing period 41.

1. The `scan-telemetry` autoscaler keeps at least 20 pods, even when no doors are scanning. This is the jump.

## Fix plan

A person reviews and applies each change. Claude Code changes nothing in the world.

1. In `k8s/scan-telemetry-hpa.yaml`, set `minReplicas` to 2. A person applies it on dev first, then on prod.
