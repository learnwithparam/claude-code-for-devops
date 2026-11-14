import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { frontMatter, listField } from "./helpers/03-give-it-eyes/front-matter";
import { agentWrites, describeEntry } from "./helpers/03-give-it-eyes/world-log";
import type { Rule } from "../scripts/verify";
import { explain, read, section } from "./lib";

const STEP = "split-the-cost-hunt";
const REPORT = join("investigations", "cost-spike.md");
const MISSING_LIFECYCLE = "module.scan_store.aws_s3_bucket_lifecycle_configuration.scan";
const WRITE_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];

type Agent = { file: string; fields: Record<string, unknown> };

function agents(folder: string): Agent[] {
  const agentsFolder = join(folder, ".claude", "agents");
  if (!existsSync(agentsFolder)) return [];
  const files = readdirSync(agentsFolder).filter((file) => file.endsWith(".md"));
  return files.map((file) => ({ file, fields: frontMatter(read(agentsFolder, file)) }));
}

// An agent with no tools line gets every tool, Edit and Write too.
function writeProblem(agent: Agent): string | undefined {
  const tools = listField(agent.fields.tools);
  if (tools.length === 0) return `${agent.file}: no tools line, so it can use every tool`;
  const writers = tools.filter((tool) => WRITE_TOOLS.includes(tool));
  if (writers.length > 0) return `${agent.file}: can use ${writers.join(", ")}`;
  return undefined;
}

const rootCauses = (folder: string) => listField(frontMatter(read(folder, REPORT)).root_causes);

const namesAutoscaler = (cause: string) => /scan-telemetry/.test(cause);

export default [
  {
    says: "three or more subagents in .claude/agents/, each with a name and a description",
    test: (folder) => {
      const found = agents(folder);
      const complete = found.filter((agent) => agent.fields.name && agent.fields.description);
      return found.length >= 3 && complete.length === found.length;
    },
    tryNext:
      "ask for terraform-history, cluster-workloads and billing-export in .claude/agents/, " +
      "each with name and description in its front matter",
  },
  {
    says: "every subagent lists its tools, and none can Edit or Write",
    test: (folder) => {
      const found = agents(folder);
      const problems = found.map(writeProblem).filter((problem) => problem !== undefined);
      explain(STEP, problems);
      return found.length > 0 && problems.length === 0;
    },
    tryNext:
      "the lines above name each agent that can write; give it tools: Read, Grep, Glob, Bash",
  },
  {
    says: "the report's root_causes names the missing lifecycle rule",
    test: (folder) => rootCauses(folder).includes(MISSING_LIFECYCLE),
    tryNext: `put ${MISSING_LIFECYCLE} in root_causes; the archive grows each billing period`,
  },
  {
    says: "the report's root_causes names the scan-telemetry autoscaler",
    test: (folder) => rootCauses(folder).some(namesAutoscaler),
    tryNext: "put HorizontalPodAutoscaler/scan-telemetry in root_causes; read its minReplicas",
  },
  {
    says: "root_causes holds those two causes and nothing else",
    test: (folder) => {
      const causes = rootCauses(folder);
      const known = (cause: string) => cause === MISSING_LIFECYCLE || namesAutoscaler(cause);
      return causes.length === 2 && causes.every(known);
    },
    tryNext: "a guess is not a cause; keep only causes the evidence proves",
  },
  {
    says: "the report has Evidence, Cause and Fix plan, and the evidence names billing period 41",
    test: (folder) => {
      const report = read(folder, REPORT);
      const hasSections = ["Evidence", "Cause", "Fix plan"].every(
        (heading) => section(report, heading).length > 0,
      );
      return hasSections && /period 41\b/.test(section(report, "Evidence"));
    },
    tryNext:
      "ask for the sections Evidence, Cause and Fix plan, with the costs before and after " +
      "billing period 41",
  },
  {
    says: "nothing but a person changed the world while Claude Code looked",
    test: (folder) => {
      const writes = agentWrites(folder);
      explain(STEP, writes.map(describeEntry));
      return writes.length === 0;
    },
    tryNext:
      "the lines above show what changed the world; the fix plan proposes, a person applies. " +
      "Run bun run world reset to start clean",
  },
] satisfies Rule[];
