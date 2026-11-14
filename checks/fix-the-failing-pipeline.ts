// Lays the learner's ci.yml and scan-store module over a fresh copy of the world, then asks the
// world whether its CI fault is fixed. The practice repo keeps ci.yml in workflows/; the world
// reads it from the GitHub workflows folder, so the check copies it there.

import type { Rule } from "../scripts/verify";
import { withWorldCopy } from "./helpers/04-run-it-in-ci/world-copy";
import { explain, faults, plan, read } from "./lib";

const STEP = "fix-the-failing-pipeline";
const MODULE = "terraform/modules/scan-store/main.tf";
const OVERLAYS = [
  { from: "workflows/ci.yml", to: ".github/workflows/ci.yml" },
  { from: MODULE, to: MODULE },
];

type WorldAnswer = { ciFixed: boolean; evidence: string; devChanges: string[]; parses: boolean };

function askTheWorld(folder: string): WorldAnswer {
  return withWorldCopy(folder, OVERLAYS, (home) => {
    const ciFault = faults(home).find((fault) => fault.id === "ci");
    let devChanges: string[] = [];
    let parses = true;
    try {
      devChanges = plan("dev", home).map((change) => `${change.actions} ${change.address}`);
    } catch {
      parses = false;
    }
    return {
      ciFixed: ciFault?.fixed === true,
      evidence: ciFault?.evidence ?? "",
      devChanges,
      parses,
    };
  });
}

const savedAnswers = new Map<string, WorldAnswer>();
function worldAnswer(folder: string): WorldAnswer {
  const saved = savedAnswers.get(folder);
  if (saved) return saved;
  const answer = askTheWorld(folder);
  savedAnswers.set(folder, answer);
  return answer;
}

const ciText = (folder: string) => read(folder, "workflows", "ci.yml");
const moduleText = (folder: string) => read(folder, ...MODULE.split("/"));

export default [
  {
    says: "workflows/ci.yml and the scan-store module are in your folder",
    test: (folder) => ciText(folder) !== "" && moduleText(folder) !== "",
    tryNext: "keep workflows/ci.yml and terraform/modules/scan-store/main.tf in the problem folder",
  },
  {
    says: "the tflint step still runs on the scan-store module",
    test: (folder) => /tflint\s+--chdir=terraform\/modules\/scan-store/.test(ciText(folder)),
    tryNext: "fix the module so tflint passes; deleting the lint step hides the fault",
  },
  {
    says: "the scan-store module declares required_version and required_providers",
    test: (folder) => {
      const code = moduleText(folder);
      return /required_version\s*=/.test(code) && /required_providers\s*\{/.test(code);
    },
    tryNext: "add a terraform block to the module, like the one in terraform/envs/dev/main.tf",
  },
  {
    says: "the module still parses, and the dev plan stays empty",
    test: (folder) => {
      const answer = worldAnswer(folder);
      explain(STEP, answer.devChanges);
      return answer.parses && answer.devChanges.length === 0;
    },
    tryNext: "this fix adds no resource; keep the queue and the bucket exactly as they were",
  },
  {
    says: "the world says its CI fault is fixed: every action pinned and tflint clean",
    test: (folder) => {
      const answer = worldAnswer(folder);
      if (!answer.ciFixed) explain(STEP, [answer.evidence]);
      return answer.ciFixed;
    },
    tryNext: "pin each uses: to its 40 character commit SHA, with the tag in a comment",
  },
] satisfies Rule[];
