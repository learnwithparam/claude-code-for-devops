# How Claude Code got to this answer

This folder is the end state. Claude Code added the `sandbox` block to `settings.json`. You typed the prompt below,
read the plan, and said yes or no.

## The prompt

Start Claude Code in the root folder of the course repo, then type:

```text
Add a sandbox block to parts/01-fence-the-agent/04-sandbox-the-shell/problem/.claude/settings.json.
Turn the sandbox on, and stop Claude Code if the sandbox cannot start.
Do not let a failed command run again outside the sandbox.
Deny reads of ~/.aws, ~/.ssh and ~/.kube/prod.
Allow the network only to registry.terraform.io and registry.tallowmark.test.
Under filesystem, add "allowWrite": ["../.state", "../logs"] so the world's tools can save their records.
Keep my permissions and my hook as they are. Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan adds one block and touches nothing else:

1. `"enabled": true` and `"failIfUnavailable": true`.
2. `"allowUnsandboxedCommands": false`.
3. `filesystem.denyRead`: `~/.aws`, `~/.ssh` and `~/.kube/prod`.
4. `filesystem.allowWrite`: `../.state` and `../logs`.
5. `network.allowedDomains`: `registry.terraform.io` and `registry.tallowmark.test`.

The sample answer also allows `api.anthropic.com`. Claude Code itself needs that host when it runs inside the
sandbox. If Claude Code suggests it, say yes.

## What you check before you say yes

- `allowUnsandboxedCommands` is written as `false`. If the plan leaves it out, reply: "Set it to false. Do not
  leave it out." The `wrong/escape-hatch-open` answer shows this mistake.
- The network list has no `"*"`. The `wrong/whole-internet` answer shows this mistake.
- The `permissions` and `hooks` blocks are the same as before. Ask: "Show me the diff of settings.json."

## Then run the check

```bash
bun run verify sandbox-the-shell
```

Expect: `Done. All 6 rules pass.`
