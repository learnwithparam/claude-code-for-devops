# Claude Code ways of working

This page lists the Claude Code techniques this course teaches. Each one links to the step where you use it.
Come back here when you forget how to do one.

You write no code. You give Claude Code a job in plain English, read its plan, and say yes or no.

## Give it a job in plain English

Type what you want, the way you would tell a new teammate. For example, "Read this file and tell me which
environment it points at."

You do this in [meet-the-world](meet-the-world/problem/README.md), and then in every step.

## Start Claude Code in a folder

Claude Code works in the folder where you start it. Start it in the root folder of this course repo, so it can see
every step. Type `claude` and press Enter.

You do this in [write-the-deny-rules](../parts/01-fence-the-agent/01-write-the-deny-rules/problem/README.md).

## Sign in

Type `/login` inside Claude Code and sign in in the browser. You do this once, in [Set up](README.md).

## Ask for the plan before it changes anything

End a prompt with "Show me your plan before you change the file." Claude Code then tells you what it will do. You
read the plan and say yes or no. This is a habit you build with your own words, and it is not a switch.

You use it from [write-the-deny-rules](../parts/01-fence-the-agent/01-write-the-deny-rules/problem/README.md) on.

## Say yes or no to a permission prompt

Claude Code asks before it does something risky. A person says yes or no. Deny rules, ask rules and allow rules
decide which actions ask, and which never run.

You write these in [write-the-deny-rules](../parts/01-fence-the-agent/01-write-the-deny-rules/problem/README.md).

## Switch the permission mode

The permission mode decides who says yes to each action. Press Shift+Tab inside Claude Code to move to the next
mode. The course explains default, acceptEdits, plan, auto and dontAsk, and why a repo on prod should not use auto
or bypass.

You do this in
[choose-the-permission-mode](../parts/01-fence-the-agent/05-choose-the-permission-mode/problem/README.md).

## Put a hook in front of every command

A hook is a small program that Claude Code runs before a tool. It can block the action.

You do this in [block-the-apply](../parts/01-fence-the-agent/02-block-the-apply/problem/README.md) and
[catch-the-sneaky-commands](../parts/01-fence-the-agent/03-catch-the-sneaky-commands/problem/README.md).

## Turn on the sandbox

Type `/sandbox` inside Claude Code. The sandbox lets the operating system stop a command that reads a path or calls a
host you did not allow.

You do this in [sandbox-the-shell](../parts/01-fence-the-agent/04-sandbox-the-shell/problem/README.md).

## Teach it the repo with CLAUDE.md

`CLAUDE.md` is a file Claude Code reads at the start of every session. It holds the facts about your repo. Rules
in `.claude/rules/` can apply to only some paths.

You do this in [write-the-repo-memory](../parts/02-teach-the-repo/01-write-the-repo-memory/problem/README.md).

## Write a skill and start it with a slash command

A skill is a runbook that Claude Code follows. You start one with a slash command, such as `/drain-a-node`. You can
also stop Claude Code from starting a skill on its own.

You do this in [write-a-runbook-skill](../parts/02-teach-the-repo/04-write-a-runbook-skill/problem/README.md).

## Connect a tool with an MCP server

An MCP server gives Claude Code a tool, such as read-only access to a cluster. A file named `.mcp.json` lists the
servers.

You do this in
[connect-the-cluster-read-only](../parts/03-give-it-eyes/01-connect-the-cluster-read-only/problem/README.md).

## Split a big job across subagents

A subagent is a helper that works on one part of a job and reports back. Type `/agents` to see them. You can run
three at once.

You do this in [split-the-cost-hunt](../parts/03-give-it-eyes/03-split-the-cost-hunt/problem/README.md).

## Let it read a docs page

Start a prompt with "Read" and a link. Claude Code reads the page, and then answers from it.

You do this in
[choose-the-permission-mode](../parts/01-fence-the-agent/05-choose-the-permission-mode/problem/README.md) and in
[split-the-cost-hunt](../parts/03-give-it-eyes/03-split-the-cost-hunt/problem/README.md).

## Run it without a person

`claude -p` runs Claude Code with one prompt and no screen. It can answer in a fixed shape. The course uses it for a
plan review.

You do this in [review-the-plan-headless](../parts/04-run-it-in-ci/01-review-the-plan-headless/problem/README.md).

## Run it in CI

A pipeline can start Claude Code with a fixed permission mode and a turn limit. It signs in with a token you make
once with `claude setup-token`.

You do this in [wire-the-plan-review](../parts/04-run-it-in-ci/02-wire-the-plan-review/problem/README.md).

## Lock settings that a repo cannot change

Managed settings apply to everyone on a machine, and a repo cannot override them. You do this in
[seal-the-devcontainer](../parts/05-ship-the-kit/01-seal-the-devcontainer/problem/README.md).

## Leave a session

Type `/exit` to close Claude Code. You do this in
[split-the-cost-hunt](../parts/03-give-it-eyes/03-split-the-cost-hunt/problem/README.md).

## Use it in your editor

You can work in Claude Code inside VS Code, JetBrains or Claude Desktop. The files it writes are the same.
See [Set up](README.md).

## Ask Claude Code to check your work

In every step, ask Claude Code to run the check and tell you what it printed. Do not let it change anything to make
the check pass. The check reads files and logs, and never what Claude said. So the check, not Claude, decides if you
are done.

```text
Run the check for this step and tell me what it printed. Do not change anything to make it pass.
```

You can also run it yourself. For example, after meet-the-world, type `bun run verify meet-the-world`.
