# How Claude Code got to this answer

This folder is the end state. Claude Code wrote `.claude/skills/drain-a-node/SKILL.md`. You read it and checked
that no line could reach prod.

## Prompt 1: write the skill

```text
Write a skill in
parts/02-teach-the-repo/04-write-a-runbook-skill/problem/.claude/skills/drain-a-node/SKILL.md.
It drains one node on dev only. Front matter: name drain-a-node, a one-line description,
disable-model-invocation: true, and allowed-tools that only pre-approve
kubectl get and kubectl describe with --context kind-tallowmark-dev.
Sections: Before you start, Commands Claude Code runs (reads only),
Commands a person runs (cordon, drain, uncordon), and Stop if.
Every kubectl line names --context kind-tallowmark-dev.
Show me the file before you save it.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Front matter with the name, a description, `disable-model-invocation: true` and two `allowed-tools` lines.
2. Three reads Claude Code runs: nodes, pods with `-o wide`, and `describe node`.
3. Three writes a person runs: cordon, drain, uncordon.
4. A Stop if list: the wrong context, a prod node name, and a `seat-api` pod with nowhere to go.

## What you check before you say yes

- `allowed-tools` names the dev context. The `wrong/runs-on-prod` answer lists `Bash(kubectl *)`. That
  pre-approves `kubectl drain` with no context, which goes to prod.
- `disable-model-invocation: true` is there. The `wrong/model-can-start-it` answer leaves it out, so Claude
  Code may start a drain when you only asked about a node.
- Claude Code runs only reads. The `wrong/claude-runs-the-drain` answer puts cordon and drain under "Commands
  Claude Code runs". The guard hook blocks them, so the skill fails halfway. It also has no Stop if section.

## Then run the check

```bash
bun run verify write-a-runbook-skill
```

Expect: `Done. All 8 rules pass.`
