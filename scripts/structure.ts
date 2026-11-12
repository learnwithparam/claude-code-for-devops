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

// What a step.toml may hold. Every field is optional, so a half-written file still loads.
type StepToml = { minutes?: unknown; screen?: unknown; solution?: unknown };

function subfolders(folder: string): string[] {
  if (!existsSync(folder)) return [];
  const entries = readdirSync(folder);
  const folders = entries.filter((entry) => statSync(join(folder, entry)).isDirectory());
  return folders.sort();
}

// Folders keep an order prefix for sorting only. Learners never type it.
export const bareName = (folder: string) => folder.replace(/^\d+-/, "");

function readStepToml(stepDir: string): StepToml {
  const tomlPath = join(stepDir, "step.toml");
  if (!existsSync(tomlPath)) return {};
  return Bun.TOML.parse(readFileSync(tomlPath, "utf8")) as StepToml;
}

function readStep(partDir: string, folder: string, partName: string): Step {
  const stepDir = join(partDir, folder);
  const toml = readStepToml(stepDir);
  return {
    name: bareName(folder),
    dir: stepDir,
    part: partName,
    meta: {
      minutes: Number(toml.minutes ?? 0),
      screen: Boolean(toml.screen),
      solution: Boolean(toml.solution),
    },
  };
}

function readPart(dir: string, name: string): Part {
  const isStepFolder = (folder: string) =>
    existsSync(join(dir, folder, "step.toml")) || /^\d+-/.test(folder);
  const stepFolders = subfolders(dir).filter(isStepFolder);
  const steps = stepFolders.map((folder) => readStep(dir, folder, name));
  return { name, dir, steps };
}

function everyPartFolder(): Part[] {
  const partsRoot = join(ROOT, "parts");
  return subfolders(partsRoot).map((folder) => readPart(join(partsRoot, folder), bareName(folder)));
}

// The orientation is the first part: its step lives in 00-orientation/<step-name>/.
// A part folder with no steps yet is planned, not built. plannedParts() lists it, and the checks
// leave it out until a part session adds its steps.
export function parts(): Part[] {
  const orientation = readPart(join(ROOT, "00-orientation"), "orientation");
  const built = everyPartFolder().filter((part) => part.steps.length > 0);
  if (orientation.steps.length === 0) return built;
  return [orientation, ...built];
}

export function plannedParts(): Part[] {
  return everyPartFolder().filter((part) => part.steps.length === 0);
}

export const allSteps = () => parts().flatMap((part) => part.steps);

export function findStep(name: string): Step | undefined {
  return allSteps().find((step) => step.name === name);
}
