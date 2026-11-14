# Incident triage: seat-api

## What I saw

Buyers get errors at checkout. The seat-api pods in prod restart again and again.

## Evidence

```bash
kubectl get pods -n seat --context kind-tallowmark-prod
kubectl describe pod seat-api-10x7 -n seat --context kind-tallowmark-prod
kubectl logs seat-api-10x7 -n seat --previous --context kind-tallowmark-prod
```

The pods show CrashLoopBackOff. The last log line says the app cannot open port 8080, and the probe checks 8081.

## Likely cause

The seat-api release changed its probe port. The pods fail the probe and restart. This is a guess from the
evidence above. I did not change anything.

## Rollback (a person runs this)

The on-call engineer decides. Claude Code does not run this command:

```text
helm rollback seat-api 1 -n seat --kube-context kind-tallowmark-prod
```

Then the on-call engineer watches `kubectl get pods` until the pods are ready.

## Watch it

After the rollback, keep a read only check running:

```text
/loop 5m kubectl get pods -n seat --context kind-tallowmark-prod
```

Stop the loop when every pod is ready.
