# tallowmark-infra

Infrastructure for Tallowmark Tickets: seat holds and checkout, the on-sale waiting room, door scanner telemetry and
the buyer records bucket.

## Environments

- `dev` and `prod`. Your shell starts on prod (`.envrc`). Say which one you are in before any command.

## Commands

- `terraform -chdir=terraform/envs/<env> plan -detailed-exitcode`
- `helm lint charts/<name>` and `helm template <name> charts/<name>`
- `kubectl get pods -A --context kind-tallowmark-dev`

## Never

- Apply, destroy or delete anything. A person applies. A hook blocks these, and this line is not the guard.
- Read `.env`, `~/.aws` or any state file.

## Done means

- `terraform plan -detailed-exitcode` exits 0 on the env you changed, after a person applies.
- `helm lint` passes and the dev pods are Running.
