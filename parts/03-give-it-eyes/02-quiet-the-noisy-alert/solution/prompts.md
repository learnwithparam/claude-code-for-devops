# How Claude Code got to this answer

This folder is the end state. Claude Code changed `alerts/seat.rules.yml` and wrote `alerts/seat.test.yml`. You
typed one prompt, read the reason it gave, and checked the numbers in its plan.

## Prompt 1: explain, fix and test

```text
Work in parts/03-give-it-eyes/02-quiet-the-noisy-alert/problem/alerts/.
Read seat.rules.yml and series.yml. Tell me why SeatApiSlow pages on the short spikes.
Then change SeatApiSlow so it watches p99 latency over 1 second, with for: 5m.
Keep the alert name, the severity label and the group.
Then write seat.test.yml, a promtool unit test for seat.rules.yml:
100 requests a minute, normally all under 0.25 seconds; a 2 minute spike at minute 40
where 2 of 100 requests are slow; and minutes 100 to 114 where every request takes
over 1 second. Expect no alert at 42m and SeatApiSlow firing at 110m.
Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. The reason: p50 goes over 0.3 seconds in each spike, and `for: 0m` pages at once.
2. The new rule: `histogram_quantile(0.99, ...) > 1` over a five minute rate, with `for: 5m`.
3. A unit test with four bucket series, one quiet check at `42m` and one firing check at `110m`.

## What you check before you say yes

- The quantile is 0.99. The `wrong/longer-for-only` answer keeps p50 and only waits longer.
- `for` is five minutes. The `wrong/p99-no-hold` answer still pages on a one minute spike.
- The threshold is under 2.4 seconds. The `wrong/threshold-too-high` answer never pages at all.

## Play the series through the new rule

```bash
bun checks/helpers/03-give-it-eyes/alerts.ts parts/03-give-it-eyes/02-quiet-the-noisy-alert/solution
```

Expect: three `silent` lines for the spikes, and `FIRES` for the slowdown at minute 100.

## Then run the check

```bash
bun run verify quiet-the-noisy-alert
```

Expect: `Done. All 7 rules pass.`
