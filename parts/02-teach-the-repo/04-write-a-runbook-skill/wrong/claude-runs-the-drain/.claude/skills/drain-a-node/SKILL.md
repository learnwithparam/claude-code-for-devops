---
name: drain-a-node
description: Drain a dev node, then check the pods moved. Dev only.
disable-model-invocation: true
allowed-tools:
  - Bash(kubectl get * --context kind-tallowmark-dev)
  - Bash(kubectl describe * --context kind-tallowmark-dev)
---

# Drain a node on dev

Use this when a dev node needs work, such as a new kernel. It runs on dev only.

## Commands Claude Code runs

Run these in order and show me the output.

```sh
kubectl get nodes --context kind-tallowmark-dev
kubectl cordon tallowmark-dev-control-plane --context kind-tallowmark-dev
kubectl drain tallowmark-dev-control-plane --ignore-daemonsets --delete-emptydir-data --context kind-tallowmark-dev
kubectl get pods -A -o wide --context kind-tallowmark-dev
kubectl uncordon tallowmark-dev-control-plane --context kind-tallowmark-dev
```
