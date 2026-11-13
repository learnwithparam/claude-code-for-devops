// A fresh copy of the world in a temporary folder, with some of the learner's files laid over
// the world repo. Checks read it and then throw it away, so the learner's own world is never
// touched. The supervisor may move this into checks/lib.
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { seedInstance } from "../../../world/lib/seed";
import { repoDir } from "../../../world/sim/state";

// One file to copy: where it is in the learner's folder, and where it goes in the world repo.
export type Overlay = { from: string; to: string };

// Seed a world, copy each file that exists, run `read`, then remove the copy.
export function withWorldCopy<T>(
  folder: string,
  overlays: Overlay[],
  read: (home: string) => T,
): T {
  const home = mkdtempSync(join(tmpdir(), "tallowmark-"));
  try {
    seedInstance(home);
    for (const overlay of overlays) {
      const source = join(folder, overlay.from);
      if (!existsSync(source)) continue;
      const target = join(repoDir(home), overlay.to);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(source, target, { recursive: true, force: true });
    }
    return read(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}
