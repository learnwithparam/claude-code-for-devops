# Parts

What is built, what is left, and what each step's check reads. A part session starts from this file alone.

| Part folder | State | Steps (minutes) | Total |
|---|---|---|---|
| `00-orientation/` | built | `meet-the-world` (15) | 15 |
| `parts/01-fence-the-agent/` | built | `write-the-deny-rules` (15), `block-the-apply` (25), `catch-the-sneaky-commands` (20), `sandbox-the-shell` (20), `choose-the-permission-mode` (10) | 90 |
| `parts/02-teach-the-repo/` | skeleton | `write-the-repo-memory` (15), `fix-the-drift` (20), `fix-the-helm-chart` (20), `write-a-runbook-skill` (20) | 75 |
| `parts/03-give-it-eyes/` | skeleton | `connect-the-cluster-read-only` (25), `quiet-the-noisy-alert` (20), `split-the-cost-hunt` (30) | 75 |
| `parts/04-run-it-without-you/` | skeleton | `review-the-plan-headless` (30), `wire-the-plan-review` (25), `fix-the-failing-pipeline` (20), `seal-the-devcontainer` (25), `ship-the-guardrail-kit` (20) | 120 |

Total: 375 minutes. `schedules.toml` maps these onto the delivery formats.

## How a part session builds a part

1. Add `NN-<step-name>/` folders to the part with `step.toml` (`minutes`, `screen`, `solution`), `problem/README.md`
   (The problem, Your challenge, Done when, If you get stuck, Words you will use), the starter in `problem/`,
   `solution/`, at least one `wrong/<mistake>/`, and `images/expected.png` for a screen step.
2. Add `checks/<step-name>.ts`. Import from `checks/lib` (see below). Never read a chat transcript.
3. Replace `TODO(part session)` in the part README's Walkthrough with the commands, each followed by an `Expect:` line.
4. A part folder with no steps is skipped by `bun run check`; once it has one step, every rule applies to it.
5. `bun run check` must pass. `bun run shots` recaptures the screenshots.

Each step's `problem/` starts from the previous step's `solution/`. The learner's work lives in `problem/`; the
checker is handed that folder (or `solution/`, or a `wrong/` folder) and reads only what is in it, plus the world.

## The world API (`checks/lib`)

| Import | What it gives a check |
|---|---|
| `ensureWorld()` | Seeds `world/live` if it is missing, never resets it |
| `plan(env, home)` | The planned changes for `dev` or `prod`: the code under `terraform/envs/<env>` (with its local modules) against the cloud state |
| `loadCloud(env)`, `loadCluster(env)` | The world's system of record: buckets, queues, Helm releases, autoscalers |
| `readLog("commands.jsonl")` | Every world tool call: tool, args, env, `mutating`, `actor` (`ops-oncall` for planted drift) |
| `mutatingByAgent(home)` | Calls that changed the world without a person |
| `faults(home)` | The five planted faults, each `fixed` or not, with evidence |
| `suite(dir, sets)`, `decide(dir, tool, json)` | Runs PreToolUse hooks from `dir/.claude/settings.json` on the planted calls |
| `readSettings`, `denies`, `allows` | Settings, and Claude Code style rule matching |
| `threeRuns(run, pass)` | Judges behaviour that varies run to run over the 3 recorded `claude -p` runs: sets `CLAUDE_RUN` to 1, 2, 3 and `CLAUDE_REPLAY=1` |
| `world/lib/claude.ts` | `mode()`, `runClaude()`, `transcript()`: runs the real `claude -p` when it is installed and signed in, or replays `world/recordings/<name>.jsonl`. The course has no model API |

The world tools in `world/bin` are small simulations in `world/sim/cli.ts`. To support a new command a step needs
(for example `kubectl auth can-i` for part three), add it there and to the troubleshooting table.

## What each remaining step's check reads

### teach-the-repo

| Step | The check reads |
|---|---|
| `write-the-repo-memory` | `CLAUDE.md` under 200 lines with sections Environments, Commands, Never, Done means; `.claude/rules/terraform.md` with `paths:` front matter that matches `terraform/envs/prod/main.tf`; the guard hook from part one still wired |
| `fix-the-drift` | The learner's Terraform files copied over a fresh world, then `plan("prod")` after the checker applies as `person`: zero changes; versioning `Enabled` and all four public access flags true in `loadCloud("prod")`; no agent `apply` in `commands.jsonl` |
| `fix-the-helm-chart` | `charts/seat-api/values.yaml`: pinned tag, CPU and memory limits, probe port equal to `containerPort`; the rendered template; after the checker upgrades the dev release, no pod in `CrashLoopBackOff` |
| `write-a-runbook-skill` | `SKILL.md` front matter `name`, `description`, `disable-model-invocation: true`, `allowed-tools` with no write tool for prod; body names `kind-tallowmark-dev` and a stop condition; each listed command passes the finished guard |

### give-it-eyes

| Step | The check reads |
|---|---|
| `connect-the-cluster-read-only` | ClusterRole YAML: verbs only `get`, `list`, `watch`, no `secrets`; `.mcp.json` names the reader kubeconfig; settings deny MCP delete tools. Needs `kubectl auth can-i` added to the world's kubectl |
| `quiet-the-noisy-alert` | `alerts/seat.rules.yml` evaluated on `alerts/series.yml` (the checker replays the series): silent on the 3 short spikes, fires on the sustained one; p99, `for` of 5m or more |
| `split-the-cost-hunt` | Three files in `.claude/agents/` whose `tools` exclude Edit and Write; `root_causes` in the report front matter equal `module.scan_store.aws_s3_bucket_lifecycle_configuration.scan` (missing) and `scan-telemetry` autoscaler `minReplicas`; a Fix plan section; no agent write in `commands.jsonl`. `billing/cost-export.csv` holds the spike from billing period 41 |

### run-it-without-you

| Step | The check reads |
|---|---|
| `review-the-plan-headless` | Runs `review.config.json`'s command on each file in `plans/`, each of the 3 recorded `claude -p` runs with `threeRuns` (recordings in `world/recordings/plan-review/<plan>/run-N.jsonl`); compares to `world/guard/plan-answers.json`: verdict, exact `destroys` and `replaces`. The finished answer is `world/finished/overlay/review/plan-review.ts` |
| `wire-the-plan-review` | The workflow file inside the world repo: every `uses:` pinned by a 40 character SHA, `permissions` only `contents: read` and `pull-requests: write`, an explicit permission mode and max turns, no `AWS_SECRET_ACCESS_KEY`; the action signs in with the learner's own account through `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` (made with `claude setup-token`), never a Console API key; the review still blocks `destroy-orders-db` with an injection line in the PR body |
| `fix-the-failing-pipeline` | The world repo's `.github/workflows/ci.yml` (practice CI, never the course repo's): all actions pinned by SHA; the scan-store module declares `required_providers`. `faults(home)` reports `ci` fixed |
| `seal-the-devcontainer` | `devcontainer.json` valid; Claude Code pinned; firewall allow list only the API, the package registry and the world registry; managed settings with `allowManagedHooksOnly` and `disableBypassPermissionsMode` |
| `ship-the-guardrail-kit` | Copies `kit/` into a fresh world copy and runs the full guard suite: 30 of 30 blocked, 15 of 15 allowed, fails closed; `kit/README.md` has What it blocks, What it does not block, How to test it |

## Claude Code, not a model API

This course runs on the real Claude Code, signed in with the learner's own Claude account. No step calls a model
API, ships a stand-in for Claude, or asks for an API key. A step that needs Claude Code to do something
runs `claude -p` through `world/lib/claude.ts` and its check reads what that run left behind: files, the world's
logs and state. Each such run is recorded 3 times with `bun run record` (see `world/recordings/RECORD.md`), so every
check passes in CI with no Claude Code at all. A new recording is added to `world/recordings/record.ts`.
