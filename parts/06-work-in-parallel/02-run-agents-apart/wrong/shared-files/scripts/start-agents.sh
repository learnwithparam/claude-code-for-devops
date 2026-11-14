#!/bin/sh
# One agent per worktree. Each has its own copy of the repo, so edits cannot collide.
claude -w pin-actions \
  -p "Pin every uses: in workflows/ci.yml by a full commit SHA." \
  --permission-mode acceptEdits --max-turns 10 &
claude -w limit-chart \
  -p "Add cpu and memory limits to charts/seat-api/values.yaml." \
  --permission-mode acceptEdits --max-turns 10 &
claude -w tag-buckets \
  -p "Add the owner tag to every bucket in terraform/modules/scan-store." \
  --permission-mode acceptEdits --max-turns 10 &
wait
