# Quiet the noisy alert

## The problem

An alert that pages for nothing teaches people to ignore pages. Then the real one gets missed.

`SeatApiSlow` watches p50 latency, the median request, with `for: 0m`. For example, three spikes of one or two minutes each paged the on-call person. Fans never noticed. Later, p99 sat at 2.4 seconds and cost sales.

## Watch it done

```mermaid
flowchart LR
  S[alerts/series.yml] --> R{SeatApiSlow}
  R -->|3 short spikes| Q[silent]
  R -->|long slowdown| P[page]
  T[alerts/seat.test.yml] -.promtool test rules.-> R
```

On the starter, all four lines say `FIRES`. On the sample answer, only the slowdown pages:

```text
short spike  at minute 40, for 1 min   silent
sustained    at minute 100, for 15 min FIRES
```

![The alert check passing on the sample answer](../images/expected.png)

## Your turn

1. Try the starter:

```bash
bun checks/helpers/03-give-it-eyes/alerts.ts parts/03-give-it-eyes/02-quiet-the-noisy-alert/problem
```

Expect: four lines, and each one says `FIRES`.

2. Start Claude Code in the root folder of this course repo. Give it this job:

```text
Work in parts/03-give-it-eyes/02-quiet-the-noisy-alert/problem/alerts/.
Read seat.rules.yml and series.yml. Tell me why SeatApiSlow pages on the short spikes.
Then change SeatApiSlow so it watches p99 latency over 1 second, with for: 5m.
Keep the alert name, the severity label and the group.
Then write seat.test.yml, a promtool unit test: 100 requests a minute, normally
under 0.25 seconds; a 2 minute spike at minute 40; and minutes 100 to 114 where every
request takes over 1 second. Expect no alert at 42m and SeatApiSlow firing at 110m.
Show me your plan first.
```

Expect: a plan. Does it keep the threshold below the 2.4 seconds of the real slowdown?

## Do it on your work

Pick one alert on your team that pages too often. Ask Claude Code to find which pages were real, then add a longer `for:` or a p99 measure. Good looks like silence on the noise and a page on the real thing.

## Done when

- `SeatApiSlow` watches p99 latency and waits `for: 5m` or more.
- It stays silent on all 3 short spikes in `alerts/series.yml`, and fires in the slowdown.
- `alerts/seat.test.yml` expects no alert in a spike and `SeatApiSlow` in the slowdown.
- If `promtool` is installed, `promtool test rules` passes too.

```bash
bun run verify quiet-the-noisy-alert
```

Expect: `Done. All 7 rules pass.`

## Solution

The after state is in `../solution/`. It changes `alerts/seat.rules.yml` to p99 with `for: 5m`, and adds `alerts/seat.test.yml`. Prompts: `../solution/prompts.md`.

## If you get stuck

| What you see | What to ask Claude Code |
|---|---|
| `FAIL SeatApiSlow watches p99 latency` | "Use histogram_quantile(0.99, ...). A longer for on p50 still hides the slow tail." |
| `FAIL it stays silent on all 3 short spikes` | "Set for: 5m. The longest spike is two minutes." |
| `FAIL it fires during the sustained slowdown` | "The threshold is above 2.4 seconds. Bring it down to 1 second." |

## Words you will use

- **p50 and p99**: half of requests are faster than p50. 99 of 100 are faster than p99.
- **for**: how long the condition must hold before the alert fires.
- **promtool**: the Prometheus tool that checks rules and runs their unit tests.
