# Batch plan

## Command

```text
/batch Pin the actions, limit the chart and tag the buckets, one unit each, and open a branch for each.
```

## Units

| Unit | Paths it may change |
|---|---|
| pin-actions | workflows/ci.yml |
| limit-chart | charts/seat-api/values.yaml |
| tag-buckets | terraform/modules/scan-store/ |
