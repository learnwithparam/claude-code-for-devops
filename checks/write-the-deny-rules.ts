import type { Rule } from "../scripts/verify";
import { allows, denies, readSettings } from "./lib";

// A rule that passes when the learner's deny list stops this one tool call.
function denyRule(says: string, tool: string, input: string, tryNext: string): Rule {
  return {
    says,
    test: (folder) => denies(readSettings(folder), tool, input),
    tryNext,
  };
}

export default [
  {
    says: ".claude/settings.json exists and is valid JSON",
    test: (folder) => readSettings(folder) !== null,
    tryNext:
      "create .claude/settings.json in the problem folder and check it has no comments or " +
      "trailing commas",
  },
  denyRule(
    "a deny rule stops terraform apply",
    "Bash",
    "terraform apply -auto-approve",
    'add "Bash(terraform apply *)" to permissions.deny',
  ),
  denyRule(
    "a deny rule stops terraform destroy",
    "Bash",
    "terraform destroy -auto-approve",
    'add "Bash(terraform destroy *)" to permissions.deny',
  ),
  denyRule(
    "a deny rule stops kubectl delete",
    "Bash",
    "kubectl delete ns seat",
    'add "Bash(kubectl delete *)" to permissions.deny',
  ),
  denyRule(
    "a deny rule stops helm uninstall",
    "Bash",
    "helm uninstall seat-api",
    'add "Bash(helm uninstall *)" to permissions.deny',
  ),
  {
    says: "a deny rule stops reading .env anywhere in the repo",
    test: (folder) => {
      const settings = readSettings(folder);
      return (
        denies(settings, "Read", ".env") && denies(settings, "Read", "terraform/envs/prod/.env")
      );
    },
    tryNext: 'add "Read(**/.env)": a bare "Read(.env)" only covers the folder Claude starts in',
  },
  denyRule(
    "a deny rule stops reading ~/.aws",
    "Read",
    "~/.aws/credentials",
    'add "Read(~/.aws/**)"; a path that starts with one / means the project folder, not your home',
  ),
  {
    says: "terraform plan is still allowed, so the agent can look without asking",
    test: (folder) => {
      const settings = readSettings(folder);
      const plan = "terraform plan -detailed-exitcode";
      return allows(settings, "Bash", plan) && !denies(settings, "Bash", plan);
    },
    tryNext:
      'keep "Bash(terraform plan *)" in permissions.allow and make sure no deny rule covers plan',
  },
] satisfies Rule[];
