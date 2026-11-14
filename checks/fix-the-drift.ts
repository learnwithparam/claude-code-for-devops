import { agentChanges, withWorldCopy } from "./helpers/02-teach-the-repo/world-copy";
import type { Rule } from "../scripts/verify";
import { applyPlan, loadCloud, plan } from "../world/sim/state";
import { explain, read, section } from "./lib";

const STEP = "fix-the-drift";
const DRIFTED = [
  "aws_s3_bucket_versioning.buyer_records",
  "aws_s3_bucket_public_access_block.buyer_records",
];
const PUBLIC_ACCESS_SETTINGS = [
  "block_public_acls",
  "block_public_policy",
  "ignore_public_acls",
  "restrict_public_buckets",
];
const PERSON = /\b(person|human|engineer|on-call|oncall|platform team|reviewer)\b/i;

const note = (folder: string) => read(folder, "reviews", "buyer-records-drift.md");

type AfterApply = { error: string; changesLeft: string[]; secure: boolean; devChanges: number };

function isSecure(home: string): boolean {
  const cloud = loadCloud("prod", home);
  const versioning = cloud[DRIFTED[0]]?.attrs.versioning_configuration as { status?: string }[];
  const accessBlock = cloud[DRIFTED[1]]?.attrs ?? {};
  const versioningOn = versioning?.[0]?.status === "Enabled";
  return versioningOn && PUBLIC_ACCESS_SETTINGS.every((setting) => accessBlock[setting] === true);
}

// The checker plays the person: it applies the prod plan of the learner's code on a fresh drifted
// world, then plans again. Done means the second plan is empty and the bucket is locked again.
function applyAsPerson(folder: string): AfterApply {
  return withWorldCopy(folder, ["terraform"], (home) => {
    try {
      applyPlan("prod", plan("prod", home), home);
      const changesLeft = plan("prod", home).map((change) => change.address);
      const devChanges = plan("dev", home).length;
      return { error: "", changesLeft, secure: isSecure(home), devChanges };
    } catch (error) {
      const message = (error as Error).message;
      return { error: message, changesLeft: [], secure: false, devChanges: 0 };
    }
  });
}

export default [
  {
    says: "the Terraform code parses",
    test: (folder) => {
      const result = applyAsPerson(folder);
      if (result.error) explain(STEP, [result.error]);
      return result.error === "";
    },
    tryNext: "ask Claude Code to run terraform validate on prod and fix what it reports",
  },
  {
    says: "reviews/buyer-records-drift.md has What drifted, The plan and Who applies",
    test: (folder) => {
      const headings = ["What drifted", "The plan", "Who applies"];
      return headings.every((heading) => section(note(folder), heading).length > 0);
    },
    tryNext: "ask for exactly these three headings, each with text under it",
  },
  {
    says: "What drifted names both drifted resource addresses",
    test: (folder) => {
      const whatDrifted = section(note(folder), "What drifted");
      return DRIFTED.every((address) => whatDrifted.includes(address));
    },
    tryNext: "ask Claude Code to copy each address from the prod plan output, word for word",
  },
  {
    says: "Who applies names a person, not Claude Code",
    test: (folder) => PERSON.test(section(note(folder), "Who applies")),
    tryNext: "a person runs the apply; ask Claude Code to say who, such as the on-call engineer",
  },
  {
    says: "after a person applies, the prod plan shows no changes",
    test: (folder) => {
      const result = applyAsPerson(folder);
      explain(STEP, result.changesLeft);
      return result.error === "" && result.changesLeft.length === 0 && note(folder) !== "";
    },
    tryNext: "the code must say what prod should be; run plan again and read each line",
  },
  {
    says: "prod's buyer records keep versioning on and every public access setting true",
    test: (folder) => applyAsPerson(folder).secure,
    tryNext:
      "the code is the source of truth; put Enabled and true back in the code, " +
      "never copy the hand change into it",
  },
  {
    says: "the dev plan still shows no changes",
    test: (folder) => {
      const result = applyAsPerson(folder);
      return result.error === "" && result.devChanges === 0;
    },
    tryNext: "the drift is on prod only; ask Claude Code to undo its change to dev",
  },
  {
    says: "nothing changed the world without a person",
    test: (folder) => {
      const changes = agentChanges(folder);
      const lines = changes.map((entry) => `${entry.tool} ${(entry.args ?? []).join(" ")}`);
      explain(STEP, lines);
      return changes.length === 0;
    },
    tryNext:
      "Claude Code plans and writes the note; a person applies. " +
      "Run bun run world reset and try again",
  },
] satisfies Rule[];
