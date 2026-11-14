// Reads workflows/plan.yml as text. It runs no workflow.
import type { Rule } from "../scripts/verify";
import { read } from "./lib";

const workflow = (folder: string) => read(folder, "workflows", "plan.yml");
const codeLines = (folder: string) =>
  workflow(folder)
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"));

export default [
  {
    says: "the job asks for id-token write and contents read",
    test: (folder) => {
      const text = codeLines(folder).join("\n");
      return /^\s*id-token:\s*write\s*$/m.test(text) && /^\s*contents:\s*read\s*$/m.test(text);
    },
    tryNext: "add a permissions block with contents: read and id-token: write",
  },
  {
    says: "no permission is wider than that",
    test: (folder) => !/:\s*write\s*$/m.test(codeLines(folder).join("\n").replace(/id-token:\s*write/g, "")),
    tryNext: "remove every write permission except id-token",
  },
  {
    says: "the job assumes a role",
    test: (folder) => /configure-aws-credentials@/.test(workflow(folder)) && /role-to-assume:\s*arn:aws:iam::\d+:role\/\S+/.test(workflow(folder)),
    tryNext: "add aws-actions/configure-aws-credentials with role-to-assume set to the role ARN",
  },
  {
    says: "no AWS key or secret is named anywhere",
    test: (folder) => workflow(folder) !== "" && !/AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|secrets\.AWS/i.test(workflow(folder)),
    tryNext: "delete every secrets.AWS line and the env block that held them",
  },
  {
    says: "every uses: is pinned by a 40 character SHA, and the job never applies",
    test: (folder) => {
      const lines = codeLines(folder);
      const uses = lines.filter((line) => /\buses:/.test(line));
      const pinned = uses.every((line) => /@[0-9a-f]{40}\b/.test(line));
      return uses.length > 0 && pinned && !/terraform apply/.test(lines.join("\n"));
    },
    tryNext: "pin each uses: by a full commit SHA and remove any terraform apply",
  },
] satisfies Rule[];
