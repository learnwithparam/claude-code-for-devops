// The capstone check: bun capstone/check.ts <your folder>
// It reads only the folder you give it: REPORT.md, .claude/settings.json and own-results.md.
// It proves the shape of your report, and that its evidence matches a file you hold.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CapstoneRule, readArtefact, runCapstoneCheck } from "../checks/capstone";

const SECTIONS = ["Repo", "What I fenced", "Evidence", "What it does not stop", "Next step"];
// A role or a first and last name. The word "team" alone does not name anyone.
const PERSON = /\b(lead|manager|engineer|owner|on-call|[A-Z][a-z]+ [A-Z][a-z]+)\b/;
const COURSE_NAMES = /tallowmark|kind-tallowmark|seat-api|buyer-records/i;

function sectionText(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
}

const report = (folder: string) => readArtefact(folder, "REPORT.md");
const countLines = (text: string) =>
  [...text.matchAll(/^(Blocked|Allowed): \d+ of \d+\s*$/gim)]
    .map((found) => found[0].trim())
    .sort();

function denyRules(folder: string): string[] {
  try {
    const settings = JSON.parse(readFileSync(join(folder, ".claude", "settings.json"), "utf8"));
    return settings?.permissions?.deny ?? [];
  } catch {
    return [];
  }
}

const rules: CapstoneRule[] = [
  {
    says: "REPORT.md has Repo, What I fenced, Evidence, What it does not stop and Next step",
    test: (folder) => SECTIONS.every((name) => sectionText(report(folder), name).length > 10),
    tryNext: "fill each of the five headings with at least a sentence about your repo",
  },
  {
    says: "the report is about your repo, not a course example",
    test: (folder) => report(folder) !== "" && !COURSE_NAMES.test(report(folder)),
    tryNext: "remove every course name; write the name of your own repo",
  },
  {
    says: ".claude/settings.json has at least three deny rules",
    test: (folder) => denyRules(folder).length >= 3,
    tryNext: "put your own deny rules in .claude/settings.json, at least three",
  },
  {
    says: "Evidence shows a command and Blocked and Allowed counts",
    test: (folder) => {
      const evidence = sectionText(report(folder), "Evidence");
      return /bun run |claude -p/.test(evidence) && countLines(evidence).length === 2;
    },
    tryNext: "paste the command, then the Blocked and Allowed lines, each on its own line",
  },
  {
    says: "the evidence counts match own-results.md",
    test: (folder) => {
      const fromReport = countLines(sectionText(report(folder), "Evidence"));
      const fromFile = countLines(readArtefact(folder, "own-results.md"));
      const real = fromFile.length === 2 && !fromFile.every((line) => / 0 of 0/.test(line));
      return real && fromReport.join() === fromFile.join();
    },
    tryNext: "run the kit cases on your repo, then copy the real counts word for word",
  },
  {
    says: "What it does not stop is honest, and Next step names a person",
    test: (folder) => {
      const limits = sectionText(report(folder), "What it does not stop");
      const next = sectionText(report(folder), "Next step");
      return limits.length > 20 && !/nothing|fully|completely/i.test(limits) && PERSON.test(next);
    },
    tryNext: "list one real gap, and name who you will ask to act next",
  },
];

runCapstoneCheck(rules);
