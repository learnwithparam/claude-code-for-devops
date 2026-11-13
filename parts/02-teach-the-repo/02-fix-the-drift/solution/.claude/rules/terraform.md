---
paths:
  - "terraform/**/*.tf"
---

# Terraform in this repo

- The code is the source of truth. If prod differs from the code, prod has drifted.
- Fix drift by changing the cloud back to the code. Change the code only when a person says the code is wrong.
- Run `plan` from `terraform/envs/dev` or `terraform/envs/prod`, never from the repo root.
- Read every line of the plan. Name each resource address that will change.
- The buyer records bucket holds names, emails and payment references. Versioning stays on, and all four
  public access settings stay `true`.
- Pin provider versions exactly, as `6.73.0`, never `~> 6.0`.
