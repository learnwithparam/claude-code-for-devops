# Assignment: turn a review rule into a policy

Optional in the live session. Expected as homework.

## Task

Have Claude Code turn one of your review rules into a policy that gates the plan. Use a rule you raised in class.
You write no code. You write prompts in `prompts.md`, and Claude Code writes the Rego.

The starter is in `starter/`: the two plan files, an empty policy and an empty `prompts.md`. A working reference
is in `parts/05-check-infrastructure-rules-with-conftest/01-write-the-plan-policy/solution/`. This folder needs no
containers, so `compose.yaml` starts none.

Also write `CHOICE.md`: three or four sentences on when you would pick Checkov 3.4.5 instead.

## Done when

The check script tests each line and writes `assignment/result.json`:

```bash
bun checks/assignment.ts
```

Expect: `PASS` on all three lines and `Assignment passes.`

- Conftest reports v0.71.1.
- The bad plan fails and the good plan passes.
- `conftest verify` passes.

## Rubric

A person reads these three lines.

- The rule is one you raised in class.
- The failure message tells a reader what to fix.
- `CHOICE.md` says when Checkov is the better pick.

## Submit

Push a branch named `assignment` and send its URL. The grader runs `bun checks/assignment.ts` again.
