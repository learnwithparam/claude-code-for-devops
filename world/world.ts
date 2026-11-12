// bun run world              seed the world if it is not there, then show where it is
// bun run world reset        throw away the world and seed it again with every fault in place
// bun run world use <step>   point the world repo's .claude folder at that step's problem/.claude
// bun run world status       show the world's environments and its five faults
import { existsSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { findStep } from "../scripts/structure";
import { faults } from "./lib/faults";
import { isSeeded, seedInstance } from "./lib/seed";
import { instance, loadCloud, loadCluster, repoDir, WORLD } from "./sim/state";

const [command, stepName] = process.argv.slice(2);
const home = instance();
const repo = repoDir(home);
// A path as seen from where the learner is standing.
const shortPath = (path: string) => relative(process.cwd(), path) || ".";

function status() {
  const worldFaults = faults(home);
  const prodResources = Object.values(loadCloud("prod", home));
  const bucketCount = prodResources.filter((resource) => resource.type === "aws_s3_bucket").length;
  const releaseCount = Object.keys(loadCluster("prod", home).releases).length;
  const openCount = worldFaults.filter((fault) => !fault.fixed).length;
  console.log(`World: Tallowmark Tickets, repo at ${shortPath(repo)}`);
  console.log(
    `Environments: dev and prod. prod holds ${bucketCount} buckets and ${releaseCount} Helm releases.`,
  );
  console.log(`Faults still in place: ${openCount} of ${worldFaults.length}`);
  for (const fault of worldFaults) {
    const state = fault.fixed ? "fixed" : "OPEN ";
    console.log(`  ${state}  ${fault.name}: ${fault.evidence}`);
  }
}

function showUse() {
  console.log(`To work in the world, run these in your terminal:`);
  console.log(`  export PATH="${resolve(WORLD, "bin")}:$PATH"`);
  console.log(`  cd ${shortPath(repo)} && source .envrc`);
}

// Point the world repo's .claude folder at one step's problem/.claude.
function useStep() {
  const step = stepName && findStep(stepName);
  if (!step) {
    console.log("Name a step: bun run world use <step-name>");
    process.exit(1);
  }
  if (!isSeeded(home)) seedInstance(home);
  const target = join(step.dir, "problem", ".claude");
  if (!existsSync(target)) {
    console.log(`The step ${stepName} has no problem/.claude folder to use.`);
    process.exit(1);
  }
  const link = join(repo, ".claude");
  try {
    if (lstatSync(link)) rmSync(link, { recursive: true, force: true });
  } catch {
    // There is no .claude folder yet, so there is nothing to remove.
  }
  symlinkSync(target, link, "dir");
  console.log(`The world repo now uses ${shortPath(target)} as its .claude folder.`);
  const where = shortPath(repo);
  console.log(
    `Start Claude Code in ${where} and your settings and hooks for ${stepName} are live.`,
  );
}

if (command === "reset" || (!command && !isSeeded(home))) {
  seedInstance(home);
  console.log("The world is ready: Tallowmark Tickets with 5 faults planted.");
  status();
  showUse();
} else if (!command || command === "status") {
  status();
  if (!command) showUse();
} else if (command === "use") {
  useStep();
} else {
  const commands =
    "bun run world, bun run world reset, bun run world use <step-name>, bun run world status";
  console.log(`Unknown command "${command}". Try: ${commands}.`);
  process.exit(1);
}
