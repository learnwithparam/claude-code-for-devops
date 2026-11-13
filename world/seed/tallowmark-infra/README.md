# tallowmark-infra

The infrastructure repo for Tallowmark Tickets. Four people on the platform team own it.

| Path | What it holds |
|---|---|
| `terraform/envs/dev`, `terraform/envs/prod` | Cloud resources for each environment: the buyer records bucket and the scan store |
| `terraform/modules/scan-store` | The bucket and queue that take door scanner readings at every show |
| `charts/seat-api` | Seat holds and checkout. If it is down, nobody can buy a ticket |
| `charts/waiting-room` | The queue fans wait in when a big show goes on sale |
| `k8s/` | Plain manifests, such as the scan telemetry autoscaler |
| `alerts/` | Prometheus alert rules and the series they are tested on |
| `billing/cost-export.csv` | The cloud bill, one row per billing period and service |
| `plans/` | Saved Terraform plans, as JSON, waiting for review |
| `.github/workflows/ci.yml` | Lint, validate and plan on every pull request |

Your shell starts pointed at prod. Check `TALLOWMARK_ENV` before you run anything.
