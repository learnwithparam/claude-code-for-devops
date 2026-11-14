# How Claude Code got to this answer

This folder is the end state. The cases come from one real repo, not from the course world.

## Prompt 1: find your own dangerous calls

```text
Read this repo's Makefile, scripts and CI files. List five commands that could do harm here, such as an apply on
staging or a delete on the shop namespace. Add four read-only commands we use every day. Write them to
own-cases.jsonl, one JSON line each, with id, expect, tool_name, tool_input and why. Do not copy a case from
world/guard/cases.jsonl. Show me the list first.
```

## What you check before you say yes

- Each dangerous case is a command that exists in your repo, not a guess.
- Each safe case is something your team runs all day. A kit that blocks it gets switched off.
