# How Claude Code got to this answer

This folder is the end state. Claude Code wrote `notes/first-look.md`. You typed the prompt below and checked each
line of the note.

## The prompt

Start Claude Code in the root folder of the course repo, then type:

```text
Read world/live/tallowmark-infra/.envrc and run bun run board.
Then fill in 00-orientation/meet-the-world/problem/notes/first-look.md under its four headings:
1. Where my shell points: the one environment the .envrc points at, and the line that shows it.
2. The fault that worries me most: one fault from the board, by name, and why.
3. A command I would never let an agent run: one command, in backticks, that changes or deletes something.
4. How I asked: say you used plan mode, point at a file with @, and link a screenshot of the board in notes/.
Keep the headings exactly as they are.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. Read `.envrc`. It sets `TALLOWMARK_ENV=prod` and `AWS_PROFILE=tallowmark-prod`.
2. Run `bun run board` and list the five faults.
3. Write the note: prod, one fault such as the buyer records drift, and a command such as
   `terraform destroy -auto-approve`.

## What you check before you say yes

- The environment is `prod`, and the note names the line that shows it. The `wrong/points-at-dev` answer guesses
  `dev` instead.
- The fault is one of the five on the board.
- The command changes something. The `wrong/safe-command` answer names `terraform plan`, which only reads.

## Then run the check

```bash
bun run verify meet-the-world
```

Expect: `Done. All 4 rules pass.`
