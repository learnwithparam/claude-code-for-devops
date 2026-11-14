# How Claude Code got to this answer

This folder is the end state. Claude Code wrote the four files in `.devcontainer/`. You typed one prompt, read the
plan, and pushed back once.

## Prompt 1: write the container

```text
Read https://code.claude.com/docs/en/devcontainer and the managed settings page in the same docs.
In parts/04-run-it-without-you/04-seal-the-devcontainer/problem/.devcontainer/, write
devcontainer.json, a Dockerfile, init-firewall.sh and managed-settings.json.
The Dockerfile installs @anthropic-ai/claude-code at the exact version that claude --version prints, sets DISABLE_AUTOUPDATER=1,
and copies managed-settings.json to /etc/claude-code/managed-settings.json.
The firewall drops everything except api.anthropic.com, registry.npmjs.org and registry.tallowmark.test.
It runs at start, with --cap-add=NET_ADMIN. Managed settings set allowManagedHooksOnly to true and
disableBypassPermissionsMode to disable. Then the repo's hook stops running, so copy
.claude/hooks/guard-infra.ts into /etc/claude-code/hooks/ and wire it in the managed settings.
Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. `devcontainer.json` builds from the Dockerfile, with the repo root as the build context.
2. The Dockerfile pins Node, Claude Code and Bun, and copies the settings, the hook and the firewall script.
3. `init-firewall.sh` allows local traffic and name lookups, adds the three hosts, then drops the rest.
4. The script ends by checking that `example.com` does not answer.

## What you push back on

In one run, the first plan also allowed `github.com` and `sentry.io`, "so git and error reports work". You said:

```text
Only the three hosts. If something else is needed, I will add it by hand after I read why.
```

The `wrong/firewall-allows-everything` answer shows that mistake, with the default left at ACCEPT.

## What you check before you say yes

- The version is exact. The `wrong/claude-unpinned` answer installs `latest`.
- Bypass mode is off in managed settings. The `wrong/bypass-still-allowed` answer forgets it.
- The guard hook is in managed settings. The `wrong/guard-switched-off` answer sets managed hooks only and so turns
  the guard off.

## Then run the check

```bash
bun run verify seal-the-devcontainer
```

Expect: `Done. All 9 rules pass.`
