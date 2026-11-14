# How Claude Code got to this answer

This folder is the end state. The telemetry switch lives in managed settings, so a developer cannot turn it off.

## Prompt 1: add the env block

```text
Read the monitoring page in the Claude Code docs. In managed/managed-settings.json keep allowManagedHooksOnly and add
an env block that turns on telemetry, exports metrics and logs over OTLP with grpc to https://otel.tallowmark.test:4317,
and does not log what people type. Show me the file first.
```

## What you check before you say yes

- The endpoint is a collector the team owns, over https.
- Prompts are not exported.
- No token sits in the file. A token in managed settings is readable by every developer.
