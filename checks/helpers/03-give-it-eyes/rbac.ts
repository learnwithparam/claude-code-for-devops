// A small `kubectl auth can-i` for the practice world. It reads the RBAC YAML a learner made and
// answers what one ServiceAccount may do, by following ClusterRoleBindings to ClusterRoles.
// The practice clusters have no real API server, so this is how a check asks the question.
//
// Try it: bun checks/helpers/03-give-it-eyes/rbac.ts <step folder> <verb> <resource>
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const READER_NAME = "claude-reader";
export const RBAC_FILE = join("k8s", "claude-reader.yaml");

type PolicyRule = { verbs?: string[]; resources?: string[] };
type Subject = { kind?: string; name?: string; namespace?: string };
type Manifest = {
  kind?: string;
  metadata?: { name?: string; namespace?: string };
  rules?: PolicyRule[];
  subjects?: Subject[];
  roleRef?: { kind?: string; name?: string };
};

// Every document in the RBAC file. A file with no documents, or one that does not parse, is empty.
export function readManifests(folder: string): Manifest[] {
  const path = join(folder, RBAC_FILE);
  if (!existsSync(path)) return [];
  try {
    const parsed = Bun.YAML.parse(readFileSync(path, "utf8"));
    const documents = Array.isArray(parsed) ? parsed : [parsed];
    return documents.filter(Boolean) as Manifest[];
  } catch {
    return [];
  }
}

// The reader's ServiceAccount, or undefined when the file does not make one.
export function readerAccount(manifests: Manifest[]): Manifest | undefined {
  return manifests.find(
    (manifest) => manifest.kind === "ServiceAccount" && manifest.metadata?.name === READER_NAME,
  );
}

function bindsTheReader(binding: Manifest, namespace: string | undefined): boolean {
  const subjects = binding.subjects ?? [];
  return subjects.some(
    (subject) =>
      subject.kind === "ServiceAccount" &&
      subject.name === READER_NAME &&
      subject.namespace === namespace,
  );
}

// The ClusterRoles bound to the reader across the whole cluster.
export function readerRoles(manifests: Manifest[]): Manifest[] {
  const namespace = readerAccount(manifests)?.metadata?.namespace;
  const bindings = manifests.filter(
    (manifest) => manifest.kind === "ClusterRoleBinding" && bindsTheReader(manifest, namespace),
  );
  const roleNames = bindings.map((binding) => binding.roleRef?.name);
  return manifests.filter(
    (manifest) => manifest.kind === "ClusterRole" && roleNames.includes(manifest.metadata?.name),
  );
}

const coversWord = (list: string[] | undefined, word: string) =>
  (list ?? []).some((entry) => entry === word || entry === "*");

// The answer `kubectl auth can-i <verb> <resource> -A --as=<the reader>` would give.
export function canI(manifests: Manifest[], verb: string, resource: string): boolean {
  if (!readerAccount(manifests)) return false;
  const rules = readerRoles(manifests).flatMap((role) => role.rules ?? []);
  return rules.some((rule) => coversWord(rule.verbs, verb) && coversWord(rule.resources, resource));
}

if (import.meta.main) {
  const [folder, verb, resource] = process.argv.slice(2);
  if (!folder || !verb || !resource) {
    console.log("Use: bun checks/helpers/03-give-it-eyes/rbac.ts <step folder> <verb> <resource>");
    process.exit(1);
  }
  const allowed = canI(readManifests(folder), verb, resource);
  console.log(allowed ? "yes" : "no");
}
