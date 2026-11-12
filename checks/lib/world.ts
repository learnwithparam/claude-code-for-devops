// What a check may read about the world: its state, its logs and its plan output.
// Never a chat transcript.
import { join } from "node:path";
import { faults, guardScore, mutatingByAgent } from "../../world/lib/faults";
import { isSeeded, seedInstance } from "../../world/lib/seed";
import {
  instance,
  loadCloud,
  loadCluster,
  plan,
  readLog,
  repoDir,
  WORLD,
} from "../../world/sim/state";

// Seed the learner's world if it is not there yet. Never resets work already done.
export function ensureWorld(home = instance()) {
  if (!isSeeded(home)) seedInstance(home);
  return home;
}

export {
  faults,
  guardScore,
  instance,
  loadCloud,
  loadCluster,
  mutatingByAgent,
  plan,
  readLog,
  repoDir,
  WORLD,
};
export const livePath = (...pathParts: string[]) => join(instance(), ...pathParts);
