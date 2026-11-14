import type { Rule } from "../scripts/verify";
import { asList, frontMatter, pathPatternMatches } from "./helpers/02-teach-the-repo/markdown";
import { read, readSettings, section, suite } from "./lib";

const LONGEST_MEMORY = 200;
const SECTIONS = ["Environments", "Commands", "Never", "Done means"];
const PROD_TERRAFORM_FILE = "terraform/envs/prod/main.tf";
const CHART_FILE = "charts/seat-api/values.yaml";

const memory = (folder: string) => read(folder, "CLAUDE.md");
const lineCount = (text: string) => text.trimEnd().split("\n").length;

// The patterns in the paths: front matter of .claude/rules/terraform.md.
function rulePaths(folder: string): string[] {
  const rule = read(folder, ".claude", "rules", "terraform.md");
  return asList(frontMatter(rule)?.paths);
}

const ruleMatchesFile = (folder: string, file: string) =>
  rulePaths(folder).some((pattern) => pathPatternMatches(pattern, file));

export default [
  {
    says: `CLAUDE.md exists and is under ${LONGEST_MEMORY} lines`,
    test: (folder) => {
      const text = memory(folder);
      return text.length > 0 && lineCount(text) < LONGEST_MEMORY;
    },
    tryNext:
      "ask Claude Code to keep only the facts it needs in every session, " +
      "and move the Terraform detail into .claude/rules/terraform.md",
  },
  {
    says: "CLAUDE.md has the sections Environments, Commands, Never and Done means",
    test: (folder) => SECTIONS.every((heading) => section(memory(folder), heading).length > 0),
    tryNext: "ask for exactly these four headings, each with at least one line under it",
  },
  {
    says: "Environments says the shell starts on prod",
    test: (folder) => /\bprod\b/i.test(section(memory(folder), "Environments")),
    tryNext: "ask Claude Code to say that .envrc points the shell at prod, so it checks first",
  },
  {
    says: "the Commands section lists no apply, destroy or delete",
    test: (folder) => {
      const commands = section(memory(folder), "Commands");
      return commands.length > 0 && !/\b(apply|destroy|delete|uninstall)\b/.test(commands);
    },
    tryNext: "keep only commands that read: plan, lint, template and get",
  },
  {
    says: "Done means names terraform plan -detailed-exitcode",
    test: (folder) => /plan\s+-detailed-exitcode/.test(section(memory(folder), "Done means")),
    tryNext: "ask Claude Code to define done as plan -detailed-exitcode exiting 0",
  },
  {
    says: `.claude/rules/terraform.md has paths: that match ${PROD_TERRAFORM_FILE}`,
    test: (folder) => ruleMatchesFile(folder, PROD_TERRAFORM_FILE),
    tryNext:
      'use paths: ["terraform/**/*.tf"]; "terraform/*.tf" only matches files ' +
      "directly in terraform/",
  },
  {
    says: "the Terraform rule does not load for the Helm chart",
    test: (folder) => rulePaths(folder).length > 0 && !ruleMatchesFile(folder, CHART_FILE),
    tryNext: "scope the rule to Terraform files, not every file in the repo",
  },
  {
    says: "the guard hook from part one still blocks 30 of 30 and allows 15 of 15",
    test: async (folder) => {
      if (!readSettings(folder)) return false;
      const { score } = await suite(folder, ["dangerous", "bypass", "safe"]);
      const blocked = score.dangerous[0] + score.bypass[0];
      return blocked === 30 && score.safe[0] === 15;
    },
    tryNext:
      "a line in CLAUDE.md is advice, not a guard; " +
      "keep the hook and its wiring in .claude/settings.json",
  },
] satisfies Rule[];
