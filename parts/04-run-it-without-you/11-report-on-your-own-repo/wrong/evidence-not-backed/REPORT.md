# Report on my repo

## Repo

shop-infra holds the Terraform and Helm charts for our online shop. Four people push to it.

## What I fenced

I denied apply, delete and uninstall in `.claude/settings.json`, and blocked reads of `.env`. Plans and reads stay
open, so the team keeps using Claude Code for them.

## Evidence

```text
bun run verify run-the-kit-on-your-repo
Blocked: 9 of 9
Allowed: 4 of 4
```

The same counts are in `own-results.md`. The cases came from our scripts and CI files.

## What it does not stop

A script that runs `kubectl delete` inside it. A person with a terminal. A call the hook cannot read.

## Next step

Ask the platform lead to put the kit in managed settings for all four of us.
