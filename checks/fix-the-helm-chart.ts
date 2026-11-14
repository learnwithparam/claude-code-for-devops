import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { renderChart } from "../world/sim/cli";
import { repoDir, WORLD } from "../world/sim/state";
import { withWorldCopy } from "./helpers/02-teach-the-repo/world-copy";
import { explain } from "./lib";

const STEP = "fix-the-helm-chart";
const CHART = join("charts", "seat-api");
// The seat-api app listens on 8080: `kubectl logs` on any seat-api pod says "listening on :8080".
const APP_PORT = 8080;
const DEV = "kind-tallowmark-dev";
const PINNED_TAG = /^(v?\d+\.\d+\.\d+([-.][\w.]+)?|sha256:[0-9a-f]{64})$/;

type Values = {
  image?: { tag?: unknown };
  containerPort?: unknown;
  probe?: { port?: unknown };
  resources?: { limits?: { cpu?: unknown; memory?: unknown } };
};

function readValues(folder: string): Values {
  const valuesFile = join(folder, CHART, "values.yaml");
  if (!existsSync(valuesFile)) return {};
  try {
    return (Bun.YAML.parse(readFileSync(valuesFile, "utf8")) as Values) ?? {};
  } catch {
    return {};
  }
}

// Run one of the world's practice tools (helm or kubectl) inside a world copy.
function worldTool(home: string, tool: string, args: string[]) {
  const toolRun = Bun.spawnSync([join(WORLD, "bin", tool), ...args], {
    cwd: repoDir(home),
    // biome-ignore lint/style/useNamingConvention: the world reads this environment variable.
    env: { ...process.env, TALLOWMARK_HOME: home },
  });
  return { ok: toolRun.exitCode === 0, output: toolRun.stdout.toString() };
}

function helmLintPasses(folder: string): boolean {
  if (!existsSync(join(folder, CHART))) return false;
  return withWorldCopy(folder, ["charts"], (home) => {
    const lint = worldTool(home, "helm", ["lint", CHART]);
    explain(
      STEP,
      lint.output.split("\n").filter((line) => line.includes("ERROR")),
    );
    return lint.ok;
  });
}

// The checker deploys the learner's chart to dev, as a person would, and reads the pods.
function devPodsAfterUpgrade(folder: string): string[] {
  return withWorldCopy(folder, ["charts"], (home) => {
    worldTool(home, "helm", ["upgrade", "seat-api", CHART, "--kube-context", DEV]);
    const devContext = ["--context", DEV];
    const devPods = worldTool(home, "kubectl", ["get", "pods", "-n", "seat", ...devContext]);
    const podLines = devPods.output.split("\n");
    return podLines.filter((line) => line.startsWith("seat-api"));
  });
}

function rendered(folder: string): string {
  try {
    return renderChart(join(folder, CHART));
  } catch {
    return "";
  }
}

export default [
  {
    says: "helm lint passes on charts/seat-api",
    test: helmLintPasses,
    tryNext: "ask Claude Code to run world/bin/helm lint on the chart and fix each ERROR line",
  },
  {
    says: "the image tag is pinned to a version, not latest",
    test: (folder) => PINNED_TAG.test(String(readValues(folder).image?.tag ?? "")),
    tryNext: 'pin the tag to the appVersion in Chart.yaml, such as "2.7.1"; latest can change',
  },
  {
    says: "the container has CPU and memory limits",
    test: (folder) => {
      const limits = readValues(folder).resources?.limits;
      return Boolean(limits?.cpu) && Boolean(limits?.memory);
    },
    tryNext: "ask for resources.requests and resources.limits, each with cpu and memory",
  },
  {
    says: `the container port stays ${APP_PORT}, where the app listens`,
    test: (folder) => Number(readValues(folder).containerPort) === APP_PORT,
    tryNext: `the app listens on ${APP_PORT}; move the probe to the app, not the app to the probe`,
  },
  {
    says: "the liveness probe checks the container port",
    test: (folder) => {
      const values = readValues(folder);
      return Number(values.probe?.port) === Number(values.containerPort);
    },
    tryNext: "set probe.port to the same number as containerPort",
  },
  {
    says: "the rendered manifest has the pinned image and the probe on 8080",
    test: (folder) => {
      const manifest = rendered(folder);
      const probeOnAppPort = new RegExp(`livenessProbe:[\\s\\S]*port: ${APP_PORT}`).test(manifest);
      return manifest.length > 0 && !manifest.includes(":latest") && probeOnAppPort;
    },
    tryNext: "ask Claude Code to run world/bin/helm template seat-api on the chart and read it",
  },
  {
    says: "after the checker deploys the chart to dev, every seat-api pod is Running",
    test: (folder) => {
      const podLines = devPodsAfterUpgrade(folder);
      explain(STEP, podLines);
      const allRunning = podLines.every((line) => line.includes("Running"));
      return podLines.length > 0 && allRunning;
    },
    tryNext: "a pod in CrashLoopBackOff means the probe still misses the app's port",
  },
] satisfies Rule[];
