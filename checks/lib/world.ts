// What a check may read about the world: its state, its logs and its plan output. Never a chat transcript.
import { join } from "node:path";
import { WORLD, instance, readLog, plan, loadCloud, loadCluster, repoDir } from "../../world/sim/state";
import { seedInstance, isSeeded } from "../../world/lib/seed";
import { faults, guardScore, mutatingByAgent } from "../../world/lib/faults";

// Seed the learner's world if it is not there yet. Never resets work already done.
export function ensureWorld(home = instance()) {
  if (!isSeeded(home)) seedInstance(home);
  return home;
}

export { WORLD, instance, readLog, plan, loadCloud, loadCluster, repoDir, faults, guardScore, mutatingByAgent };
export const livePath = (...p: string[]) => join(instance(), ...p);
