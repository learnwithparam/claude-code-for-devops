// Reads the settings and the triage note. It runs no command and calls no cluster.
import type { Rule } from "../scripts/verify";
import { allows, denies, read, readSettings, section } from "./lib";

const WRITES = [
  "kubectl apply -f seat.yaml",
  "kubectl delete pod seat-api-10x7",
  "kubectl rollout undo deployment/seat-api",
  "kubectl scale deployment/seat-api --replicas=0",
  "kubectl patch deployment seat-api -p {}",
  "kubectl edit deployment seat-api",
  "kubectl exec seat-api-10x7 -- sh",
  "helm rollback seat-api 1",
  "helm upgrade seat-api ./chart",
];
const READS = ["kubectl get pods", "kubectl describe pod seat-api-10x7", "kubectl logs seat-api-10x7"];
const PERSON = /\b(person|human|engineer|on-call|oncall|platform team)\b/i;
const READ_LINE = /^kubectl (get|describe|logs)\b/;
const WRITE_WORD = /\b(apply|delete|rollout|scale|patch|edit|exec|rollback|upgrade)\b/;

const note = (folder: string) => read(folder, "incident", "triage.md");
const evidenceCommands = (folder: string) =>
  section(note(folder), "Evidence")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("kubectl "));

export default [
  {
    says: "the settings deny every write command",
    test: (folder) => {
      const settings = readSettings(folder);
      return settings !== null && WRITES.every((command) => denies(settings, "Bash", command));
    },
    tryNext: "add deny rules for apply, delete, rollout, scale, patch, edit, exec and helm rollback",
  },
  {
    says: "the settings allow no write command",
    test: (folder) => {
      const settings = readSettings(folder);
      return settings !== null && !WRITES.some((command) => allows(settings, "Bash", command));
    },
    tryNext: "remove Bash(kubectl *) from allow; list only get, describe and logs",
  },
  {
    says: "the settings still allow the read commands",
    test: (folder) => {
      const settings = readSettings(folder);
      return settings !== null && READS.every((command) => allows(settings, "Bash", command));
    },
    tryNext: "allow kubectl get, describe and logs, or Claude Code cannot look at anything",
  },
  {
    says: "the note has What I saw, Evidence, Likely cause and Rollback",
    test: (folder) => {
      const headings = ["What I saw", "Evidence", "Likely cause", "Rollback (a person runs this)"];
      return headings.every((heading) => section(note(folder), heading) !== "");
    },
    tryNext: "ask for exactly these four headings, each with text under it",
  },
  {
    says: "Evidence holds at least two read commands that name the prod context",
    test: (folder) => {
      const commands = evidenceCommands(folder);
      const reads = commands.filter((line) => READ_LINE.test(line) && !WRITE_WORD.test(line));
      return reads.length >= 2 && reads.every((line) => line.includes("kind-tallowmark-prod"));
    },
    tryNext: "paste the kubectl get, describe or logs lines you ran, each with --context",
  },
  {
    says: "Likely cause names seat-api and says it is a guess",
    test: (folder) => {
      const cause = section(note(folder), "Likely cause").toLowerCase();
      return cause.includes("seat-api") && /guess|likely|probably|not sure/.test(cause);
    },
    tryNext: "name the release and say how sure you are; a guess is fine if it says so",
  },
  {
    says: "the rollback names a person and Claude Code does not run it",
    test: (folder) => {
      const rollback = section(note(folder), "Rollback (a person runs this)");
      const hasCommand = /helm rollback|kubectl rollout undo/.test(rollback);
      return PERSON.test(rollback) && hasCommand && /not run|does not|never/i.test(rollback);
    },
    tryNext: "write the rollback command, name the on-call engineer, and say Claude Code does not run it",
  },
] satisfies Rule[];
