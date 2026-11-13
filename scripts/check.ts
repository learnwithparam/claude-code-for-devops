// bun run check: the repo standard. CI runs this; any failure stops the build.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { allSteps, type Part, parts, ROOT, type Step } from "./structure";

const problems: string[] = [];

function fail(where: string, what: string) {
  const shownPath = relative(ROOT, where) || ".";
  problems.push(`${shownPath}: ${what}`);
}

const readText = (path: string) => readFileSync(path, "utf8");

const STEP_SECTIONS = [
  "## The problem",
  "## Your challenge",
  "## Done when",
  "## If you get stuck",
  "## Words you will use",
];
const HYPE_WORDS = [
  "supercharge",
  "unleash",
  "unlock",
  "seamless(ly)?",
  "leverage",
  "dive into",
  "game[- ]changer",
  "revolutioni[sz]e",
  "magic(al)?",
  "cutting[- ]edge",
  "AI-powered",
];
const HYPE = new RegExp(`\\b(${HYPE_WORDS.join("|")})\\b`, "i");
const TIME_WORDS = /\b(week|day|hour)\s+\d+\b/i;
const VERB_THING = /^[a-z]+(-[a-z0-9]+)+$/;
const IMAGE = /!\[[^\]]*\]\(([^)\s]+)\)/g;
const MERMAID = /```mermaid\n/;
const MODEL_ID = /\b(claude-[a-z0-9-]+-\d|gpt-\d[\w.-]*|gemini-\d[\w.-]*|o\d-(mini|pro)\b)/i;
const SOLUTION_PROMPTS_MISSING =
  "solution/ has no prompts.md: " +
  "the prompts that got there, the plan Claude showed, and what you checked";

const hasImage = (text: string) => [...text.matchAll(IMAGE)].length > 0;

function everyFile(folder: string, found: string[] = []): string[] {
  for (const entry of readdirSync(folder)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) everyFile(path, found);
    else found.push(path);
  }
  return found;
}

// 1. No Makefile anywhere.
function checkNoMakefile(files: string[]) {
  for (const file of files) {
    if (/(^|\/)(GNU)?[Mm]akefile$/.test(file)) {
      fail(file, "a Makefile is not allowed; use a Bun or uv script");
    }
  }
}

// 2. Prose rules on every Markdown file.
function checkProseLine(file: string, line: string, lineNumber: number) {
  if (line.includes("—")) fail(file, `line ${lineNumber}: em dash`);
  const hypeWord = line.match(HYPE);
  if (hypeWord) fail(file, `line ${lineNumber}: hype word "${hypeWord[0]}"`);
  const timeWord = line.match(TIME_WORDS);
  if (timeWord && !file.includes("schedules")) {
    fail(file, `line ${lineNumber}: "${timeWord[0]}"; content is in parts, schedules map time`);
  }
  if (/\bM=\d+|verify \d+/.test(line)) {
    fail(file, `line ${lineNumber}: numeric step command; name the step`);
  }
}

function checkProse(markdownFiles: string[]) {
  for (const file of markdownFiles) {
    const lines = readText(file).split("\n");
    lines.forEach((line, index) => {
      checkProseLine(file, line, index + 1);
    });
  }
}

// 2b. Every page shows, not only tells: images it names exist, and the key pages carry a picture.
function checkImagesExist(markdownFiles: string[]) {
  for (const file of markdownFiles) {
    for (const match of readText(file).matchAll(IMAGE)) {
      const imagePath = match[1];
      if (/^https?:/.test(imagePath)) continue;
      if (!existsSync(join(dirname(file), imagePath))) {
        fail(file, `image "${imagePath}" does not exist`);
      }
    }
  }
}

type PictureNeeds = { mermaid: boolean; image: boolean };

function checkHasPicture(file: string, what: string, needs: PictureNeeds) {
  if (!existsSync(file)) {
    fail(file, "missing");
    return;
  }
  const text = readText(file);
  if (needs.mermaid && !MERMAID.test(text)) fail(file, `${what} needs a Mermaid diagram`);
  if (needs.image && !hasImage(text)) fail(file, `${what} needs a screenshot`);
}

// 3. Parts and steps.
function checkPartReadme(part: Part) {
  const readme = join(part.dir, "README.md");
  if (!existsSync(readme)) {
    fail(part.dir, "part has no README.md");
    return;
  }
  const text = readText(readme);
  if (!MERMAID.test(text)) fail(readme, "part README needs a Mermaid diagram");
  const afterHeading = text.split("## Walkthrough")[1];
  const walkthrough = afterHeading?.split("\n## ")[0];
  if (walkthrough === undefined) {
    fail(readme, `part README needs a "## Walkthrough" section`);
  } else if (!walkthrough.includes("```bash")) {
    fail(readme, "the walkthrough needs the commands, each with an Expect: line");
  }
}

function checkStepBasics(step: Step, namesSeen: Set<string>) {
  if (!VERB_THING.test(step.name)) {
    fail(step.dir, `step name "${step.name}" must be verb-thing in lower case`);
  }
  if (namesSeen.has(step.name)) fail(step.dir, `step name "${step.name}" is used twice`);
  namesSeen.add(step.name);
  if (!existsSync(join(step.dir, "step.toml"))) fail(step.dir, "missing step.toml");
  const minutes = step.meta.minutes;
  if (minutes < 5 || minutes > 30) {
    fail(step.dir, `step is ${minutes} min; keep a step between 5 and 30, split it if longer`);
  }
}

function checkScreenStep(step: Step, readme: string, text: string) {
  if (!existsSync(join(step.dir, "images", "expected.png"))) {
    fail(step.dir, "screen step needs images/expected.png");
  }
  if (!text.includes("images/expected.png")) {
    fail(readme, "screen step must show ../images/expected.png");
  }
}

// Returns false when the step has no problem/README.md, so the later step rules are skipped.
function checkStepReadme(step: Step): boolean {
  const readme = join(step.dir, "problem", "README.md");
  if (!existsSync(readme)) {
    fail(step.dir, "missing problem/README.md");
    return false;
  }
  const text = readText(readme);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > 600) fail(readme, `${words} words; a step README stays under 600, split the step`);
  for (const heading of STEP_SECTIONS) {
    if (!text.includes(heading)) fail(readme, `missing section "${heading}"`);
  }
  if (!MERMAID.test(text) && !hasImage(text)) {
    fail(readme, "a step shows a picture: a screenshot or a Mermaid diagram");
  }
  const doneWhen = text.split("## Done when")[1]?.split("\n## ")[0] ?? "";
  if (!/^- /m.test(doneWhen)) fail(readme, "Done when needs at least one bullet");
  if (step.meta.screen) checkScreenStep(step, readme, text);
  return true;
}

function checkStepSolutionAndCheck(step: Step) {
  if (step.meta.solution && !existsSync(join(step.dir, "solution"))) {
    fail(step.dir, "step.toml says solution but there is no solution/");
  }
  const checksFolder = join(ROOT, "checks");
  const hasTypeScriptCheck = existsSync(join(checksFolder, `${step.name}.ts`));
  const hasPythonCheck = existsSync(join(checksFolder, `${step.name}.py`));
  if (!hasTypeScriptCheck && !hasPythonCheck) fail(step.dir, `no check at checks/${step.name}.ts`);
}

// A sample solution keeps the prompts that built it, so a learner can see how it was made.
function checkSolutionPrompts(step: Step) {
  const solution = join(step.dir, "solution");
  if (existsSync(solution) && !existsSync(join(solution, "prompts.md"))) {
    fail(step.dir, SOLUTION_PROMPTS_MISSING);
  }
}

function checkPartsAndSteps(allParts: Part[]) {
  const namesSeen = new Set<string>();
  if (allParts.length === 0) fail(join(ROOT, "parts"), "no parts");
  for (const part of allParts) {
    checkPartReadme(part);
    if (part.steps.length === 0) fail(part.dir, "part has no steps");
    for (const step of part.steps) {
      checkStepBasics(step, namesSeen);
      if (checkStepReadme(step)) checkStepSolutionAndCheck(step);
      checkSolutionPrompts(step);
    }
  }
}

// 4. Commands: the README runs the finished system first,
// and every command block says what to expect.
function checkRootReadmeOrder() {
  const rootReadme = join(ROOT, "README.md");
  if (!existsSync(rootReadme)) {
    fail(ROOT, "missing README.md");
    return;
  }
  const text = readText(rootReadme);
  const firstCode = text.indexOf("```bash");
  const firstConcept = text.search(/^## (How it works|Concepts|Background|Why)/m);
  if (firstCode < 0) {
    fail(rootReadme, "the README needs a bash block that runs the finished system");
  } else if (firstConcept >= 0 && firstConcept < firstCode) {
    fail(rootReadme, "run the finished system before any concept section");
  }
}

function checkExpectLines(file: string) {
  const lines = readText(file).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "```bash") continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== "```") j++;
    const linesAfterBlock = lines.slice(j + 1);
    const nextText = linesAfterBlock.find((line) => line.trim() !== "");
    if (!nextText?.startsWith("Expect:")) {
      fail(file, `line ${i + 1}: a bash block must be followed by an Expect: line`);
    }
    i = j;
  }
}

// 5. One model config, exact pins, a troubleshooting table.
function checkModelIds(files: string[]) {
  const scanned = files.filter(
    (file) =>
      /\.(ts|py|md|json|toml|ya?ml)$/.test(file) &&
      !file.includes("/config/models.") &&
      !file.includes("/scripts/check.ts"),
  );
  for (const file of scanned) {
    const modelId = readText(file).match(MODEL_ID);
    if (modelId) {
      fail(file, `model id "${modelId[0]}" outside config/models; name models in one place`);
    }
  }
}

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function checkPinnedVersions() {
  const packagePath = join(ROOT, "package.json");
  if (existsSync(packagePath)) {
    const packageJson = JSON.parse(readText(packagePath)) as PackageJson;
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const [name, version] of Object.entries(dependencies)) {
      if (!/^\d+\.\d+\.\d+$/.test(version))
        fail(packagePath, `${name}@${version}: pin an exact version`);
    }
  }
  const pyprojectPath = join(ROOT, "pyproject.toml");
  if (!existsSync(pyprojectPath)) return;
  const looseVersion = /"([A-Za-z0-9_.\-[\]]+)\s*(>=|~=|\^|>|<)[^"]*"/g;
  for (const match of readText(pyprojectPath).matchAll(looseVersion)) {
    fail(pyprojectPath, `${match[1]}: pin with == not ${match[2]}`);
  }
}

function checkTroubleshootingTable() {
  const troubleshooting = join(ROOT, "00-orientation", "troubleshooting.md");
  const tableHeader = /\| *What you see *\| *What it means *\| *Fix *\|/;
  if (!existsSync(troubleshooting) || !tableHeader.test(readText(troubleshooting))) {
    fail(
      ROOT,
      "00-orientation/troubleshooting.md needs a table: What you see | What it means | Fix",
    );
  }
}

// 6. Every schedule covers every part, and the minutes add up.
type Session = { parts: string[]; minutes: number };
type Schedules = Record<string, { sessions: Session[] }>;

function checkOneSchedule(format: string, sessions: Session[], allParts: Part[]) {
  const schedulePath = join(ROOT, "schedules.toml");
  const listedParts = sessions.flatMap((session) => session.parts);
  for (const part of allParts) {
    if (!listedParts.includes(part.name)) {
      fail(schedulePath, `${format} leaves out part "${part.name}"`);
    }
  }
  const minutesPerPart = new Map<string, number>();
  for (const part of allParts) {
    const total = part.steps.reduce((sum, step) => sum + step.meta.minutes, 0);
    minutesPerPart.set(part.name, total);
  }
  for (const session of sessions) {
    const needed = session.parts.reduce((sum, name) => sum + (minutesPerPart.get(name) ?? 0), 0);
    if (needed > session.minutes) {
      fail(schedulePath, `${format}: a session needs ${needed} min but has ${session.minutes}`);
    }
  }
}

function checkSchedules(allParts: Part[]) {
  const schedulePath = join(ROOT, "schedules.toml");
  if (!existsSync(schedulePath)) {
    fail(ROOT, "missing schedules.toml");
    return;
  }
  const schedules = Bun.TOML.parse(readText(schedulePath)) as Schedules;
  for (const [format, schedule] of Object.entries(schedules)) {
    checkOneSchedule(format, schedule.sessions, allParts);
  }
}

const files = everyFile(ROOT);
const markdownFiles = files.filter((file) => file.endsWith(".md"));
const allParts = parts();

checkNoMakefile(files);
checkProse(markdownFiles);
checkImagesExist(markdownFiles);
checkHasPicture(join(ROOT, "README.md"), "the root README", { mermaid: true, image: true });
checkHasPicture(join(ROOT, "00-orientation", "README.md"), "the orientation", {
  mermaid: false,
  image: true,
});
checkPartsAndSteps(allParts);
checkRootReadmeOrder();
for (const file of markdownFiles) checkExpectLines(file);
checkModelIds(files);
checkPinnedVersions();
checkTroubleshootingTable();
checkSchedules(allParts);

if (problems.length > 0) {
  console.log(`The repo does not meet the standard. ${problems.length} problem(s):`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `The repo meets the standard: ${allParts.length} part(s), ${allSteps().length} step(s).`,
);
