# Fix the Helm chart

## The problem

`seat-api` holds seats and takes payment. On dev it restarts again and again. Its health probe checks port 9090,
but the app listens on 8080, so Kubernetes kills each pod as unhealthy. The chart also uses the image tag
`latest` and sets no CPU or memory limits.

## Watch it done

For example, a weak fix moves the app to port 9090 to match the probe. The pods go green, but every request fails. The real
fix moves the probe to 8080.

```mermaid
flowchart LR
  V[values.yaml] --> T[helm template]
  T --> L[helm lint]
  T --> U[a person upgrades dev]
  U --> P{probe port = 8080?}
  P -->|yes| R[Running]
  P -->|no| C[CrashLoopBackOff]
```

Before the fix, the pods look like this:

```text
seat-api   0/1   CrashLoopBackOff
```

## Your turn

1. Look at the pods and the logs in your world:

```bash
world/bin/kubectl get pods -n seat --context kind-tallowmark-dev
world/bin/kubectl logs seat-api --context kind-tallowmark-dev
```

Expect: three `seat-api` pods in `CrashLoopBackOff`, then listening on :8080.

2. Start Claude Code in the root folder of this course repo, and give it this job:

```text
seat-api crash-loops on dev. Find out why, and fix the chart in
parts/02-teach-the-repo/03-fix-the-helm-chart/problem/charts/seat-api.
Use world/bin/kubectl and world/bin/helm with --context kind-tallowmark-dev to look.
Read the pod logs to see which port the app listens on. Keep the app on that port.
Pin the image tag to the appVersion in Chart.yaml. Add CPU and memory requests and limits.
Then run world/bin/helm lint and world/bin/helm template on the chart.
Do not upgrade or install any release. Show me your plan first.
```

Expect: a plan first. Which number does it change, the probe port or the container port? Say no if it moves the app.

## Do it on your work

Point the same job at one of your own charts that restarts. Good looks like a pinned tag, set limits, and the
probe on the port the logs show.

## Done when

- `helm lint` passes.
- The image tag is a version, such as `2.7.1`.
- CPU and memory limits are set.
- The container port stays 8080, and the probe checks 8080.
- After the checker deploys the chart to dev, every `seat-api` pod is Running.

```bash
bun run verify fix-the-helm-chart
```

Expect: `Done. All 7 rules pass.`

![The chart check passing on the sample answer](../images/expected.png)

## Solution

See `../solution/`. The diff changes the chart in `charts/seat-api`: a pinned tag, limits, and the probe on 8080.
The prompts are in `../solution/prompts.md`. Read them after you try.

## If you get stuck

| What you see | What to ask Claude Code |
|---|---|
| `FAIL the container port stays 8080, where the app listens` | "Put containerPort back to 8080 and move the probe to 8080." |
| `FAIL the image tag is pinned to a version, not latest` | "Use the appVersion from Chart.yaml as the tag. A name like stable can change." |
| `FAIL ... every seat-api pod is Running` | "Run helm template and show me the livenessProbe port." |

## Words you will use

- **Helm chart**: a folder of Kubernetes templates and a `values.yaml` that fills them in.
- **Liveness probe**: a check Kubernetes runs on a pod. If it fails, Kubernetes restarts the pod.
- **CrashLoopBackOff**: a pod that starts, fails, and waits longer before each new try.
