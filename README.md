# Claude Code for DevOps: guard the agent near production

Let Claude Code fix your Terraform, Helm and CI, and prove with a test that it cannot apply, delete or read a secret.

## Run the finished system

You need [Bun](https://bun.sh) 1.4.4 and git. No cloud account, no Docker and no API key. The course runs on the real
Claude Code, signed in with your own Claude account: the `claude` CLI, Claude Code in your editor, or the Code tab of
Claude Desktop. [00-orientation](00-orientation/README.md) installs it and signs you in.

```bash
bun install
bun run finished
```

Expect: `Guard suite: blocked 30 of 30 dangerous calls, allowed 15 of 15 safe calls, broken input blocked.`,
`saved plans judged right`, `left prod for a person and wrote the review` and `Everything is green.`

With Claude Code signed in, that runs it for real: a headless `claude -p` reviews 6 saved Terraform plans, and a
second session works on prod's drifted bucket with the finished guardrails on. The checks then read only what the
runs left behind: the verdicts, the world's command log, prod's state and the review file. Without Claude Code, or in
CI, it replays 3 real recorded runs from `world/recordings/` and says so in one line.

![The finished system's board: every fault fixed, 30 of 30 dangerous calls blocked, 15 of 15 safe calls allowed](images/finished-system.png)

Now watch a real recorded session: an on-call engineer tells Claude Code to apply on prod, and the finished guard
hook stops it. Each command in it is handed again to the guard on your machine:

```bash
bun run demo
```

Expect: `BLOCKED  Blocked by guard-infra: terraform apply changes real infrastructure.` and
`Changes it made to the world: 0.`

Add `--live` to run the same session on your own Claude Code.

Your own copy of the world starts with every fault open:

```bash
bun run world reset
bun run board
```

Expect: five `RED` lines and `Dangerous actions blocked:   0 of 30`.

## Who it is for

Platform, DevOps and infrastructure engineers who own Terraform, Helm, CI and alert rules.

- **New to Claude Code.** You know `terraform plan`, `kubectl get` and YAML, and you are afraid of running something on
  prod or leaking a secret. You leave able to write deny rules and a hook, watch the hook block a destroy, and fix
  drift and a bad chart with the guardrails on.
- **Already using it daily.** You use Claude Code for app code and do not trust it near CI credentials. You leave
  able to red-team your own hooks, write settings a repo cannot override, and run a headless plan review in CI with
  no write credentials.
- **Deciding whether to allow it.** You leave with a one-page kit for your security team: what it blocks, what it
  does not block, and the test that proves it.

## The world and what you build

Tallowmark Tickets, a fictional concert ticketing platform, owns one infra repo: seat checkout, the on-sale waiting
room, door scanner telemetry and a bucket of buyer records. The shell starts on prod. Five faults are planted, and
45 tool calls are waiting to test your guard. See [world/README.md](world/README.md).

```mermaid
flowchart LR
  subgraph You build
    G[Deny rules, hook, sandbox, mode]
    M[CLAUDE.md and rules]
    E[Read-only cluster access and subagents]
    R[Headless plan review and guardrail kit]
  end
  CC[Claude Code] --> G --> REPO[tallowmark-infra]
  M --> CC
  E --> CC
  REPO --> TF[terraform plan]
  REPO --> K[clusters dev and prod]
  TF --> STATE[(world state and logs)]
  K --> STATE
  STATE --> V[bun run verify step-name]
  R --> V
```

## How the course works

Start in [00-orientation](00-orientation/README.md). Each part opens with a real problem and a diagram. Each step has a
challenge, a Done when list and one command, `bun run verify <step-name>`, that prints PASS or FAIL with a Try next
line. Checks read the repo, the world's state, the hook log and plan output. They never read what Claude said.

| Part | What you do | Steps | Minutes |
|---|---|---|---|
| [Orientation](00-orientation/README.md) | Meet the world, run the finished system, see the goal | 1 | 15 |
| [Fence the agent](parts/01-fence-the-agent/README.md) | Deny rules, a guard hook, its bypasses, the sandbox, the permission mode | 5 | 90 |
| [Teach it the repo](parts/02-teach-the-repo/README.md) | Repo memory, then fix drift and a bad chart, judged by plan and the cluster | 4 | 75 |
| [Give it eyes, not hands](parts/03-give-it-eyes/README.md) | Read-only cluster access through RBAC, a noisy alert, a cost hunt with subagents | 3 | 75 |
| [Run it without you](parts/04-run-it-without-you/README.md) | A headless plan review in CI, a fixed pipeline, a sealed devcontainer, the kit | 5 | 120 |

The same parts fit several formats, from one sitting to a cohort: see [schedules.toml](schedules.toml).

## The project

A public fork of this repo with your guardrail kit: settings, the hook, the sandbox block, the guard suite with at
least five bypass cases of your own, and the plan review answering all six saved plans. Its README opens with three
numbers a manager can read in a minute: dangerous calls blocked, safe calls allowed, plans judged right.

## Before you start

Read these, about 40 minutes in all:

1. [How we built Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode), Anthropic. Why
   approving prompts is not a guard, and why a classifier is a layer, not a wall.
2. [Configure permissions](https://code.claude.com/docs/en/permissions), the Bash rules section. You arrive knowing
   deny rules can be beaten.
3. [tj-actions/changed-files advisory](https://github.com/advisories/GHSA-mrrh-fwg8-r2c3). Why this course pins
   every action and version.

## Claude Code, not a model API

Nothing in this repo calls a model API or asks for a key. Every run is the real `claude` CLI, started by
`world/lib/claude.ts` with the flags in `config/claude.ts`. Check your setup with:

```bash
bun run doctor
```

Expect: one line each for `Bun`, `git`, `Claude Code` and `Signed in`.

`bun run record` makes every recording again on your own signed-in Claude Code; `world/recordings/RECORD.md` lists
each one.

The rules every course repo follows, and the check behind each, are in [STANDARD.md](STANDARD.md). What is built and
what each remaining part's checks read is in [PARTS.md](PARTS.md).
