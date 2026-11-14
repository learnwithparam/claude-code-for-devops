# Work in parallel

This part moves the **Objective**: Claude Code works to a stop condition, and several agents never collide.

## After this part you can

set a goal with a stop condition and run agents side by side without collisions.

## You leave with

a spec, a Stop hook gate, a batch plan and a reviewer that cannot edit.

## The problem

One agent that says done too early wastes a day. For example, it stops with a red test. Several agents on the same files undo each other. A stop condition that a script checks, and a worktree for each agent, fix both.

```mermaid
flowchart LR
  S[SPEC.md] --> G[Goal with a stop hook]
  G --> W[One worktree per agent]
  W --> R[Reviewer that cannot edit]
```

## What you build

| Step | Minutes | What Claude Code makes for you | The check reads |
|---|---|---|---|
| `gate-the-goal-with-a-stop-hook` | 30 | `SPEC.md`, a Stop hook, `goal.txt` and a read-only reviewer | The hook run on a failing and a passing check, and the loop guard |
| `run-agents-apart` | 20 | `batch.md`, `scripts/start-agents.sh` and a merge reviewer | Units with no shared path, one worktree per agent, and a reviewer that cannot edit |

## Watch and read

| Kind | Title | Who made it | Why it is here | Link |
|---|---|---|---|---|
| video | Claude Code best practices for agentic coding | Anthropic, conference talk | The team that builds Claude Code shows the habits that keep agents safe and useful | https://www.youtube.com/watch?v=gv0WHhKelSE |
| video | Building effective agents | Anthropic, conference talk | Why a person stays in the loop, from the people who run agents in production | https://www.youtube.com/watch?v=D7_ipDqhtwk |
| read | Common workflows | Anthropic, official docs | Worktrees and parallel sessions in practice | https://code.claude.com/docs/en/common-workflows |
| read | Subagents | Anthropic, official docs | Reviewer agents that cannot edit | https://code.claude.com/docs/en/sub-agents |
| read | Hooks reference | Anthropic, official docs | The Stop hook that gates a goal | https://code.claude.com/docs/en/hooks |
| read | Building effective agents | Anthropic, engineering blog | Patterns for splitting work and checking it | https://www.anthropic.com/engineering/building-effective-agents |

## Project

Split one real task of yours into two units with no shared files, and run two agents on them.

## Walkthrough

Check each step in order. Each prints PASS or FAIL lines, and a Try next line under every FAIL.

```bash
bun run verify gate-the-goal-with-a-stop-hook
bun run verify run-agents-apart
```

Expect: `Done. All 7 rules pass.`, then 6 rules, once each step is solved.

Check the whole part in one go:

```bash
bun run verify part work-in-parallel
```

Expect: `Part work-in-parallel is done: 2/2 steps pass.`
