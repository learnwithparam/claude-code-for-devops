import { join } from "node:path";
import {
  findSlowRule,
  holdMinutes,
  playSeries,
  quantileOf,
} from "./helpers/03-give-it-eyes/alerts";
import type { Rule } from "../scripts/verify";
import { exists, explain, read } from "./lib";

const STEP = "quiet-the-noisy-alert";
// When the planted series is slow: three short spikes, then the slowdown that cost sales.
const SPIKE_MINUTES = [
  [10, 20],
  [40, 50],
  [70, 80],
];
const SLOWDOWN_MINUTES = [100, 130];

// biome-ignore-start lint/style/useNamingConvention: promtool names these fields.
type AlertTest = { eval_time?: string; alertname?: string; exp_alerts?: unknown[] };
type UnitTests = {
  rule_files?: string[];
  tests?: { alert_rule_test?: AlertTest[] }[];
};
// biome-ignore-end lint/style/useNamingConvention: promtool names these fields.

function readUnitTests(folder: string): UnitTests | null {
  try {
    return Bun.YAML.parse(read(folder, "alerts", "seat.test.yml")) as UnitTests;
  } catch {
    return null;
  }
}

// "110m" is 110. "1h50m" is 110.
function minutesOf(evalTime: string | undefined): number {
  const hours = Number(String(evalTime).match(/(\d+)h/)?.[1] ?? 0);
  const minutes = Number(String(evalTime).match(/(\d+)m/)?.[1] ?? 0);
  return hours * 60 + minutes;
}

const isInside = (minute: number, [start, end]: number[]) => minute >= start && minute <= end;

function slowAlertTests(folder: string): AlertTest[] {
  const unitTests = readUnitTests(folder);
  const allTests = (unitTests?.tests ?? []).flatMap((test) => test.alert_rule_test ?? []);
  return allTests.filter((test) => test.alertname === "SeatApiSlow");
}

function unitTestCoversBoth(folder: string): boolean {
  const ruleFiles = readUnitTests(folder)?.rule_files ?? [];
  const tests = slowAlertTests(folder);
  const pagesOnSlowdown = tests.some(
    (test) =>
      isInside(minutesOf(test.eval_time), SLOWDOWN_MINUTES) && (test.exp_alerts ?? []).length > 0,
  );
  const quietOnSpike = tests.some(
    (test) =>
      SPIKE_MINUTES.some((window) => isInside(minutesOf(test.eval_time), window)) &&
      (test.exp_alerts ?? []).length === 0,
  );
  return ruleFiles.includes("seat.rules.yml") && pagesOnSlowdown && quietOnSpike;
}

// promtool is optional. When it is installed, the learner's unit test must also pass for real.
function promtoolAgrees(folder: string): boolean {
  if (!Bun.which("promtool")) return true;
  const command = ["promtool", "test", "rules", "seat.test.yml"];
  const promtoolRun = Bun.spawnSync(command, { cwd: join(folder, "alerts") });
  return promtoolRun.exitCode === 0;
}

function spikesThatPage(folder: string): string[] {
  const rule = findSlowRule(folder);
  if (!rule) return ["no SeatApiSlow rule"];
  const spikes = playSeries(folder, rule).filter((entry) => entry.label === "short spike");
  const paged = spikes.filter((entry) => entry.fired);
  const lines = paged.map((entry) => `pages on the spike at minute ${entry.window.start_minute}`);
  explain(STEP, lines);
  return lines;
}

export default [
  {
    says: "alerts/seat.rules.yml has the SeatApiSlow rule",
    test: (folder) => Boolean(findSlowRule(folder)),
    tryNext: "keep the alert name SeatApiSlow; the on-call runbook links to it",
  },
  {
    says: "SeatApiSlow watches p99 latency, not the median",
    test: (folder) => {
      const rule = findSlowRule(folder);
      return Boolean(rule) && quantileOf(rule ?? {}) === 0.99;
    },
    tryNext: "use histogram_quantile(0.99, ...); a slow tail hurts buyers that p50 hides",
  },
  {
    says: "SeatApiSlow waits 5 minutes or more before it pages (for: 5m)",
    test: (folder) => holdMinutes(findSlowRule(folder) ?? {}) >= 5,
    tryNext: "set for: 5m so a one or two minute spike never wakes anyone",
  },
  {
    says: "it stays silent on all 3 short spikes in alerts/series.yml",
    test: (folder) => spikesThatPage(folder).length === 0,
    tryNext: "the lines above name each spike that still pages; raise for or the threshold",
  },
  {
    says: "it fires during the sustained slowdown from minute 100",
    test: (folder) => {
      const rule = findSlowRule(folder);
      if (!rule) return false;
      const slowdowns = playSeries(folder, rule).filter((entry) => entry.label === "sustained");
      return slowdowns.length > 0 && slowdowns.every((entry) => entry.fired);
    },
    tryNext: "the slowdown has p99 of 2.4 seconds for 15 minutes; keep the threshold below that",
  },
  {
    says: "alerts/seat.test.yml tests both: quiet on a spike, firing in the slowdown",
    test: (folder) => exists(folder, "alerts", "seat.test.yml") && unitTestCoversBoth(folder),
    tryNext:
      "ask for a promtool unit test with one eval_time inside a spike (exp_alerts: []) " +
      "and one inside the slowdown that expects SeatApiSlow",
  },
  {
    says: "promtool test rules passes, when promtool is installed",
    test: (folder) => exists(folder, "alerts", "seat.test.yml") && promtoolAgrees(folder),
    tryNext: "run promtool test rules alerts/seat.test.yml and show Claude Code what it prints",
  },
] satisfies Rule[];
