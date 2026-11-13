---
name: drain-a-node
description: Get a dev node ready for a drain, hand the drain to a person, then check the pods moved. Dev only.
allowed-tools:
  - Bash(kubectl get * --context kind-tallowmark-dev)
  - Bash(kubectl describe * --context kind-tallowmark-dev)
---

# Drain a node on dev

Use this when a dev node needs work, such as a new kernel. It runs on dev only.

## Before you start

- Run `kubectl config current-context`. Your shell starts on prod.
- Every command below names `--context kind-tallowmark-dev`. Never drop it.

## Commands Claude Code runs

These only read. Run them in order and show me the output.

```sh
kubectl get nodes --context kind-tallowmark-dev
kubectl get pods -A -o wide --context kind-tallowmark-dev
kubectl describe node tallowmark-dev-control-plane --context kind-tallowmark-dev
```

## Commands a person runs

Show these to me. Do not run them. A person types them.

```sh
kubectl cordon tallowmark-dev-control-plane --context kind-tallowmark-dev
kubectl drain tallowmark-dev-control-plane --ignore-daemonsets --delete-emptydir-data --context kind-tallowmark-dev
kubectl uncordon tallowmark-dev-control-plane --context kind-tallowmark-dev
```

After the person says the drain is done, run `kubectl get pods -A -o wide --context kind-tallowmark-dev`
again. Tell me which pods moved, and which did not.

## Stop if

- The context is not `kind-tallowmark-dev`.
- The node name has `prod` in it.
- A `seat-api` pod has nowhere to go. Fans cannot buy tickets while it is down.
