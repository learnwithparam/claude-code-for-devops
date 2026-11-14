#!/bin/sh
# Stop hook: Claude Code may not stop until the Check line in SPEC.md passes.
input=$(cat)
# A second stop in a row is let through, so a failing check cannot trap the session.
case "$input" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac
command=$(sed -n 's/^Check: //p' "$CLAUDE_PROJECT_DIR/SPEC.md" | head -n 1)
if [ -z "$command" ]; then
  echo "SPEC.md has no Check: line, so there is nothing to stop on." >&2
  exit 2
fi
if sh -c "$command" > /dev/null 2>&1; then
  exit 0
fi
echo "The check still fails: $command" >&2
exit 2
