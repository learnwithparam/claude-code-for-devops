# How Claude Code got to this answer

This folder is the end state. Claude Code looked at the dev pods and their logs, found the port the app uses,
and changed `charts/seat-api/values.yaml`. It ran `helm lint` and `helm template`. It deployed nothing.

## Prompt 1: find the fault and fix the chart

```text
seat-api crash-loops on dev. Find out why, and fix the chart in
parts/02-teach-the-repo/03-fix-the-helm-chart/problem/charts/seat-api.
Use world/bin/kubectl and world/bin/helm with --context kind-tallowmark-dev to look.
Read the pod logs to see which port the app listens on. Keep the app on that port.
Pin the image tag to the appVersion in Chart.yaml. Add CPU and memory requests and limits.
Then run world/bin/helm lint and world/bin/helm template on the chart.
Do not upgrade or install any release. Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. `kubectl get pods` shows three pods in `CrashLoopBackOff`.
2. `kubectl logs` says `listening on :8080`. The probe checks 9090. That is the crash.
3. Set `probe.port` to 8080. Leave `containerPort` at 8080.
4. Set the tag to `2.7.1`, the appVersion in `Chart.yaml`.
5. Add requests and limits for CPU and memory.
6. Run `helm lint` and `helm template`, and show the probe in the output.

## What you check before you say yes

- The probe moves, not the app. The `wrong/moved-the-container-port` answer sets both ports to 9090. The pods
  pass their probe, but the app still listens on 8080, so no request gets through.
- Both limits are set. The `wrong/no-limits` answer pins the tag and fixes the port, and leaves `resources: {}`.
- The tag is a version. The `wrong/floating-tag` answer uses `stable`, which can point at a new build tomorrow.
- No `helm upgrade` runs. If Claude Code asks to run one, say no. A person deploys.

## Then run the check

```bash
bun run verify fix-the-helm-chart
```

Expect: `Done. All 7 rules pass.`
