# Tallowmark guardrail kit

This kit stops Claude Code from changing the cloud or the clusters, or reading a secret. A person still applies
every change. Copy it into a repo, and run the test.

| File | What it does |
|---|---|
| `settings.json` | Goes to `.claude/settings.json`. Deny rules, the hook wiring, the sandbox and the permission mode. |
| `managed-settings.json` | Goes to `/etc/claude-code/` on a managed machine or in the dev container. |

## What it blocks

The test plays 45 tool calls into the hook, the same JSON Claude Code sends. For example:

- `terraform apply`, `terraform destroy`, `tofu destroy`, and `terraform state rm`.
- `kubectl delete`, `scale`, `drain` and `exec`, and `helm uninstall`, `upgrade` and `rollback`.
- Any `aws` call that is not a read, such as `aws s3 rb`.
- `git push --force` and `git reset --hard`.
- Reading `.env`, `~/.aws`, `~/.ssh`, kube configs or Terraform state, with Read or with Bash.
- The 10 bypass forms a deny rule misses. For example: a full path, `bash -c`, or `-chdir` before the verb.
  Also a flag before the kubectl verb, `git -C`, or an `env` prefix. Also `cat` on a key file, a script file, or a
  safe command chained to a bad one.
- Input the hook cannot read. It fails closed.

The sandbox is on with `failIfUnavailable`. So if the sandbox cannot start, Claude Code does not start either.

## What it does not block

Say this to anyone who reviews the kit. It is a guardrail, not a wall.

- **A program that starts a subprocess.** The hook sees the command Claude Code types. It does not see what a
  program like `make`, `npm run` or a Python script starts after that.
- **A script it cannot follow.** The hook reads shell scripts three levels deep. It does not read a Python or Go
  program, or a script that downloads another script.
- **Code the agent writes and runs later.** A file with `terraform destroy` in it is only text until something
  runs it.
- **Names it does not know.** A copy of `terraform` renamed to `tf2` gets through the hook.
- **A person.** It does not stop you from running `terraform apply` in your own shell.

The sandbox and the cloud permissions are the wall for these cases. The CI job holds no cloud key, and the
reader identity in the cluster can only get, list and watch.

## How to test it

From the root folder of the course repo:

```bash
bun run verify ship-the-guardrail-kit
```

Expect: `Done. All 8 rules pass.` The check copies the kit into a fresh folder, runs all 45 calls and one broken
input, and reads only the hook's exit codes.

To add a case, add one line to `world/guard/cases.jsonl` with a new id, then run the check again.
