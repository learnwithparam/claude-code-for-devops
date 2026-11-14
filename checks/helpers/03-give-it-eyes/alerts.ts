// Plays the recorded seat-api latency in alerts/series.yml through the SeatApiSlow rule,
// minute by minute, the way Prometheus evaluates an alert with a `for` hold.
// It reads only the parts of the rule this alert uses: the quantile, the threshold and `for`.
//
// Try it: bun checks/helpers/03-give-it-eyes/alerts.ts <step folder>
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Outside the windows that series.yml lists, seat-api is healthy:
// p50 is 0.1 seconds and p99 is 0.25 seconds.
const HEALTHY = { p50: 0.1, p99: 0.25 };
// Minutes after the last window that we keep evaluating, so a late alert still shows.
const MINUTES_AFTER = 30;

// biome-ignore-start lint/style/useNamingConvention: series.yml names these fields.
type Window = { start_minute: number; minutes: number; p50: number; p99: number };
type Series = { series: { short_spikes: Window[]; sustained: Window[] } };
// biome-ignore-end lint/style/useNamingConvention: series.yml names these fields.
export type AlertRule = { alert?: string; expr?: string; for?: string };
type RulesFile = { groups?: { rules?: AlertRule[] }[] };
export type Firing = { label: string; window: Window; fired: boolean };

function readYaml<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return Bun.YAML.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function findSlowRule(folder: string): AlertRule | undefined {
  const rulesFile = readYaml<RulesFile>(join(folder, "alerts", "seat.rules.yml"));
  const rules = (rulesFile?.groups ?? []).flatMap((group) => group.rules ?? []);
  return rules.find((rule) => rule.alert === "SeatApiSlow");
}

// "histogram_quantile(0.99, ...)" gives 0.99. Undefined when the rule uses no quantile.
export function quantileOf(rule: AlertRule): number | undefined {
  const found = String(rule.expr ?? "").match(/histogram_quantile\(\s*([\d.]+)/);
  return found ? Number(found[1]) : undefined;
}

function thresholdOf(rule: AlertRule): number {
  const found = String(rule.expr ?? "").match(/>\s*([\d.]+)\s*$/);
  return found ? Number(found[1]) : Number.POSITIVE_INFINITY;
}

// "5m" is 5, "1h" is 60, "300s" is 5. A missing `for` is 0.
export function holdMinutes(rule: AlertRule): number {
  const found = String(rule.for ?? "0m").match(/^(\d+)([smh])$/);
  if (!found) return 0;
  const amount = Number(found[1]);
  if (found[2] === "h") return amount * 60;
  if (found[2] === "s") return amount / 60;
  return amount;
}

function latencyAt(minute: number, windows: Window[], quantile: number): number {
  const window = windows.find(
    (candidate) =>
      minute >= candidate.start_minute && minute < candidate.start_minute + candidate.minutes,
  );
  const useP99 = quantile >= 0.9;
  if (useP99) return window ? window.p99 : HEALTHY.p99;
  return window ? window.p50 : HEALTHY.p50;
}

// The minutes at which the alert fires. It fires once the condition has held for `for` minutes.
export function firingMinutes(rule: AlertRule, windows: Window[]): number[] {
  const quantile = quantileOf(rule) ?? 0.5;
  const threshold = thresholdOf(rule);
  const hold = holdMinutes(rule);
  const lastWindow = Math.max(...windows.map((window) => window.start_minute + window.minutes));
  const firing: number[] = [];
  let slowSince: number | undefined;
  for (let minute = 0; minute <= lastWindow + MINUTES_AFTER; minute++) {
    const isSlow = latencyAt(minute, windows, quantile) > threshold;
    if (!isSlow) slowSince = undefined;
    else slowSince ??= minute;
    if (slowSince !== undefined && minute - slowSince >= hold) firing.push(minute);
  }
  return firing;
}

// For each window in series.yml: did the alert fire while the window lasted?
export function playSeries(folder: string, rule: AlertRule): Firing[] {
  const seriesFile = readYaml<Series>(join(folder, "alerts", "series.yml"));
  if (!seriesFile) return [];
  const spikes = seriesFile.series.short_spikes.map((window) => ({ label: "short spike", window }));
  const slowdowns = seriesFile.series.sustained.map((window) => ({ label: "sustained", window }));
  const labelled = [...spikes, ...slowdowns];
  const allWindows = labelled.map((entry) => entry.window);
  const firing = firingMinutes(rule, allWindows);
  return labelled.map(({ label, window }) => {
    const end = window.start_minute + window.minutes;
    const fired = firing.some((minute) => minute >= window.start_minute && minute < end);
    return { label, window, fired };
  });
}

if (import.meta.main) {
  const folder = process.argv[2] ?? ".";
  const rule = findSlowRule(folder);
  if (!rule) {
    console.log(`No SeatApiSlow rule in ${join(folder, "alerts", "seat.rules.yml")}`);
    process.exit(1);
  }
  for (const { label, window, fired } of playSeries(folder, rule)) {
    const when = `minute ${window.start_minute}, for ${window.minutes} min`;
    console.log(`${label.padEnd(12)} at ${when.padEnd(22)} ${fired ? "FIRES" : "silent"}`);
  }
}
