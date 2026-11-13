# Permission modes for tallowmark-infra

| Mode | What it does | When I use it on this repo |
|---|---|---|
| default | Asks before each new tool and each command that is not allowed | Every normal session. I see each write before it happens |
| acceptEdits | Accepts file edits without asking | Fixing a chart or a module on a branch, never with prod credentials loaded |
| plan | Reads and explores, edits nothing | Looking into drift or the cost spike before I decide anything |
| auto | A classifier approves actions instead of me | Not on this repo. It is a review, not a rule, and it cannot be set from project settings |
| dontAsk | Denies anything that would have asked | Headless runs in CI, with an allow list of read commands |

## This repo

Mode: auto
