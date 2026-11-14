// The capstone. It reads the learner's own folder: REPORT.md, .claude/settings.json and
// own-results.md. It never reads the course world. It proves the shape, and that the evidence
// in the report matches a file the learner holds.
import type { Rule } from "../scripts/verify";
import { read, readSettings, section } from "./lib";

const SECTIONS = ["Repo", "What I fenced", "Evidence", "What it does not stop", "Next step"];
const PERSON = /\b(lead|manager|engineer|owner|on-call|team|[A-Z][a-z]+ [A-Z][a-z]+)\b/;
const COURSE_NAMES = /tallowmark|kind-tallowmark|seat-api|buyer-records/i;

const report = (folder: string) => read(folder, "REPORT.md");
const countLines = (text: string) =>
  [...text.matchAll(/^(Blocked|Allowed): \d+ of \d+\s*$/gim)]
    .map((found) => found[0].trim())
    .sort();

export default [
  {
    says: "REPORT.md has Repo, What I fenced, Evidence, What it does not stop and Next step",
    test: (folder) => SECTIONS.every((heading) => section(report(folder), heading).length > 10),
    tryNext: "fill each of the five headings with at least a sentence about your repo",
  },
  {
    says: "the report is about your repo, not a course example",
    test: (folder) => report(folder) !== "" && !COURSE_NAMES.test(report(folder)),
    tryNext: "remove every course name; write the name of your own repo",
  },
  {
    says: ".claude/settings.json has at least three deny rules",
    test: (folder) => (readSettings(folder)?.permissions?.deny ?? []).length >= 3,
    tryNext: "put your own deny rules in .claude/settings.json, at least three",
  },
  {
    says: "Evidence shows a command and Blocked and Allowed counts",
    test: (folder) => {
      const evidence = section(report(folder), "Evidence");
      return (
        /bun run verify|bun run |claude -p/.test(evidence) && countLines(evidence).length === 2
      );
    },
    tryNext: "paste the command, then the Blocked and Allowed lines, each on its own line",
  },
  {
    says: "the evidence counts match own-results.md",
    test: (folder) => {
      const fromReport = countLines(section(report(folder), "Evidence"));
      const fromFile = countLines(read(folder, "own-results.md"));
      const real = fromFile.length === 2 && !fromFile.every((line) => / 0 of 0/.test(line));
      return real && fromReport.join() === fromFile.join();
    },
    tryNext: "run the kit cases on your repo, then copy the real counts word for word",
  },
  {
    says: "What it does not stop is honest, and Next step names a person",
    test: (folder) => {
      const limits = section(report(folder), "What it does not stop");
      return (
        limits.length > 20 &&
        !/nothing|fully|completely/i.test(limits) &&
        PERSON.test(section(report(folder), "Next step"))
      );
    },
    tryNext: "list one real gap, and name who you will ask to act next",
  },
] satisfies Rule[];
