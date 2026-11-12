// bun run world              seed the world if it is not there, then show where it is
// bun run world reset        throw away the world and seed it again with every fault in place
// bun run world use <step>   point the world repo's .claude folder at that step's problem/.claude
// bun run world status       show the world's environments and its five faults
import { existsSync, lstatSync, rmSync, symlinkSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { instance, repoDir, WORLD, loadCluster, loadCloud } from "./sim/state";
import { seedInstance, isSeeded } from "./lib/seed";
import { faults } from "./lib/faults";
import { findStep } from "../scripts/structure";

const [cmd, arg] = process.argv.slice(2);
const home = instance();
const repo = repoDir(home);
const rel = (p: string) => relative(process.cwd(), p) || ".";

function status() {
  const fs = faults(home);
  const bucketCount = Object.values(loadCloud("prod", home)).filter((r) => r.type === "aws_s3_bucket").length;
  console.log(`World: Tallowmark Tickets, repo at ${rel(repo)}`);
  console.log(`Environments: dev and prod. prod holds ${bucketCount} buckets and ${Object.keys(loadCluster("prod", home).releases).length} Helm releases.`);
  console.log(`Faults still in place: ${fs.filter((f) => !f.fixed).length} of ${fs.length}`);
  for (const f of fs) console.log(`  ${f.fixed ? "fixed" : "OPEN "}  ${f.name}: ${f.evidence}`);
}

function showUse() {
  console.log(`To work in the world, run these in your terminal:`);
  console.log(`  export PATH="${resolve(WORLD, "bin")}:$PATH"`);
  console.log(`  cd ${rel(repo)} && source .envrc`);
}

if (cmd === "reset" || (!cmd && !isSeeded(home))) {
  seedInstance(home);
  console.log(`The world is ready: Tallowmark Tickets with 5 faults planted.`);
  status();
  showUse();
} else if (!cmd || cmd === "status") {
  status();
  if (!cmd) showUse();
} else if (cmd === "use") {
  const step = arg && findStep(arg);
  if (!step) { console.log(`Name a step: bun run world use <step-name>`); process.exit(1); }
  if (!isSeeded(home)) seedInstance(home);
  const target = join(step.dir, "problem", ".claude");
  if (!existsSync(target)) { console.log(`The step ${arg} has no problem/.claude folder to use.`); process.exit(1); }
  const link = join(repo, ".claude");
  try { if (lstatSync(link)) rmSync(link, { recursive: true, force: true }); } catch {}
  symlinkSync(target, link, "dir");
  console.log(`The world repo now uses ${rel(target)} as its .claude folder.`);
  console.log(`Start Claude Code in ${rel(repo)} and your settings and hooks for ${arg} are live.`);
} else {
  console.log(`Unknown command "${cmd}". Try: bun run world, bun run world reset, bun run world use <step-name>, bun run world status.`);
  process.exit(1);
}
