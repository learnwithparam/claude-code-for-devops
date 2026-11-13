# tallowmark-infra

This repo runs Tallowmark Tickets: seat holds and checkout, the waiting room, door scanner readings and
the buyer records bucket. Four people on the platform team own it.

## Environments

- There are two: `dev` and `prod`.
- Your shell starts on prod. The file `.envrc` sets `TALLOWMARK_ENV=prod`, `AWS_PROFILE=tallowmark-prod`
  and `KUBE_CONTEXT=kind-tallowmark-prod`.
- Say which environment you are in before you run a command.
- Work on dev first. Prod changes go through a person.

## Commands

- Plan: `terraform -chdir=terraform/envs/<env> plan -detailed-exitcode`
- Check a chart: `helm lint charts/<name>` and `helm template <name> charts/<name>`
- Look at pods: `kubectl get pods -A --context kind-tallowmark-dev`
- Look at a bucket: `aws s3api get-bucket-versioning --bucket <name>`

## Never

- Never change real infrastructure yourself. A person runs every change.
- Never read `.env`, `~/.aws` or a Terraform state file.
- A hook in `.claude/hooks/guard-infra.ts` blocks these. This list is a reminder, not the guard.

## Done means

- `terraform plan -detailed-exitcode` exits 0 on the env you changed, after a person applies.
- `helm lint` passes, and the dev pods are Running.
- You wrote down what you changed and why, with the resource addresses.
