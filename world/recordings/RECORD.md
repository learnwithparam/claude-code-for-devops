# Recordings

Every file here comes from a real `claude -p` run, signed in with a Claude account. None is written by hand. They
let `bun run finished`, `bun run demo` and the checks work with no Claude Code installed, and in CI.

Each recording is the run's stream-json transcript (`<name>.jsonl`, what `claude -p --output-format stream-json
--verbose` printed, with one automatic change: every model id becomes `account-default`, so no model name ships in
the course; see `redact()` in `world/lib/claude.ts`) and, where the run changed anything, the files and world logs it left behind
(`<name>/`). A replay judges that saved output with the same checks a live run gets.

## Make them all again

On a machine where `bun run doctor` says Claude Code is installed and signed in:

```bash
bun run record
```

Expect: `Every recording is saved under world/recordings and passed its checks.`

Look at the diff before you commit. If a run fails its checks, record again or fix the cause; never edit a transcript.

## Each recording

The flags below are also in `config/claude.ts`. Every command adds `--output-format stream-json --verbose
--no-session-persistence`. `<prompt>` is the prompt in `config/claude.ts` (the plan review builds its prompt from
the plan, in `world/finished/overlay/review/plan-review.ts`).

| Recording | Made by | Runs in | Command | Output |
|---|---|---|---|---|
| Plan review, 6 plans times 3 runs | `CLAUDE_RECORD=1 CLAUDE_RUN=<n> bun world/finished.ts` | `world/.finished/tallowmark-infra` (the finished repo) | `claude -p <prompt> --permission-mode dontAsk --tools "" --max-turns 3 --strict-mcp-config --json-schema <verdict schema>` | `plan-review/<plan>/run-<n>.jsonl` |
| Finished run on the drifted world, 3 runs | the same command | `world/.finished/run-<n>/tallowmark-infra`: a fresh world with prod drifted, plus the finished `.claude/` and `CLAUDE.md`. `PATH` starts with `world/bin`, `TALLOWMARK_HOME` is `world/.finished/run-<n>` | `claude -p <FINISHED_RUN prompt> --permission-mode acceptEdits --max-turns 16` | `finished/run-<n>.jsonl`, and `finished/run-<n>/` with `logs/commands.jsonl`, `state/cloud-*.json` and `files/reviews/buyer-records-drift.md` |
| Demo: apply on prod when told to | `CLAUDE_RECORD=1 bun world/demo.ts --live` | `world/.finished/demo/tallowmark-infra`: a fresh drifted world with the finished `.claude/` and no `CLAUDE.md` | `claude -p <DEMO_RUN prompt> --permission-mode acceptEdits --max-turns 8` | `demo/run-1.jsonl` and `demo/run-1/logs/commands.jsonl` |
| Real PreToolUse hook input | `bun run record` (its last step) | `world/.finished/hook-probe/tallowmark-infra`: the finished repo plus a `.claude/settings.local.json` hook that saves its stdin | `claude -p "Run git status, then read README.md. Then stop." --allowedTools "Bash(git status)" Read --max-turns 4` | `hook-input/pretooluse-bash.json`, `hook-input/pretooluse-read.json` (the transcript is not kept) |

The finished settings turn the sandbox on with `failIfUnavailable`, so on Linux the recording machine needs
`bubblewrap` and `socat`.

## What a replay shows and hides

A replay prints what Claude Code said, the tool calls and their results. It never prints the model's name, the
session id or the cost, even though the transcript holds them.
