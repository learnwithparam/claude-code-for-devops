// Reads the repo layout once. Every other script asks this file where things are.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..");

export type Step = {
  name: string; // verb-the-thing, also the command argument
  dir: string;
  part: string;
  meta: { minutes: number; screen: boolean; solution: boolean };
};
export type Part = { name: string; dir: string; steps: Step[] };

const dirs = (p: string) =>
  existsSync(p)
    ? readdirSync(p)
        .filter((d) => statSync(join(p, d)).isDirectory())
        .sort()
    : [];

// Folders keep an order prefix for sorting only. Learners never type it.
export const bareName = (folder: string) => folder.replace(/^\d+-/, "");

function readPart(dir: string, name: string): Part {
  const steps = dirs(dir)
    .filter((s) => existsSync(join(dir, s, "step.toml")) || /^\d+-/.test(s))
    .map((s) => {
      const sdir = join(dir, s);
      const metaPath = join(sdir, "step.toml");
      const raw = existsSync(metaPath)
        ? (Bun.TOML.parse(readFileSync(metaPath, "utf8")) as any)
        : {};
      return {
        name: bareName(s),
        dir: sdir,
        part: name,
        meta: {
          minutes: Number(raw.minutes ?? 0),
          screen: Boolean(raw.screen),
          solution: Boolean(raw.solution),
        },
      };
    });
  return { name, dir, steps };
}

// The orientation is the first part: its step lives in 00-orientation/<step-name>/.
// A part folder with no steps yet is planned, not built: it is listed by plannedParts() and left out of the checks
// until a part session adds its steps.
export function parts(): Part[] {
  const root = join(ROOT, "parts");
  const orientation = readPart(join(ROOT, "00-orientation"), "orientation");
  const built = dirs(root)
    .map((p) => readPart(join(root, p), bareName(p)))
    .filter((p) => p.steps.length > 0);
  return [...(orientation.steps.length ? [orientation] : []), ...built];
}

export function plannedParts(): Part[] {
  const root = join(ROOT, "parts");
  return dirs(root)
    .map((p) => readPart(join(root, p), bareName(p)))
    .filter((p) => p.steps.length === 0);
}

export const allSteps = () => parts().flatMap((p) => p.steps);

export function findStep(name: string): Step | undefined {
  return allSteps().find((s) => s.name === name);
}
