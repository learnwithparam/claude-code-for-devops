// The practice world's terraform, tofu, kubectl, helm and aws. Each acts on the world's state, not a real cloud.
// Run through the shims in world/bin. Every call is logged; calls that change state are marked mutating.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import {
  applyPlan,
  type Change,
  ENVS,
  type Env,
  instance,
  loadCloud,
  loadCluster,
  log,
  plan,
  repoDir,
  saveCloud,
  saveCluster,
} from "./state";

const [tool, ...argv] = process.argv.slice(2);
const out = (s = "") => console.log(s);
const err = (s: string) => console.error(s);
const done = (code: number): never => process.exit(code);
const record = (mutating: boolean, env: Env | null, extra: Record<string, unknown> = {}) =>
  log({
    tool,
    args: argv,
    cwd: relative(instance(), process.cwd()) || ".",
    env,
    mutating,
    ...extra,
  });

const flag = (args: string[], ...names: string[]) => {
  for (let i = 0; i < args.length; i++) {
    for (const n of names) {
      if (args[i] === n) return args[i + 1];
      if (args[i].startsWith(n + "=")) return args[i].slice(n.length + 1);
    }
  }
  return undefined;
};
const has = (args: string[], ...names: string[]) => args.some((a) => names.includes(a));
const positional = (args: string[], takesValue: string[] = []) => {
  const p: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("-")) {
      if (takesValue.includes(args[i])) i++;
      continue;
    }
    p.push(args[i]);
  }
  return p;
};
const envOf = (s: string | undefined): Env | null =>
  s?.includes("dev") ? "dev" : s?.includes("prod") ? "prod" : null;

// ---------- terraform and tofu ----------
function terraform(args: string[]) {
  let cwd = process.cwd();
  const chdir = args.find((a) => a.startsWith("-chdir="));
  if (chdir) {
    cwd = resolve(cwd, chdir.slice(7));
    args = args.filter((a) => a !== chdir);
  }
  const [cmd, ...rest] = args;
  const m = cwd.match(/terraform\/envs\/(dev|prod)\/?$/);
  const env = (m?.[1] as Env) ?? null;
  const tfName = tool === "tofu" ? "OpenTofu" : "Terraform";
  if (!cmd || cmd === "version" || cmd === "-version") {
    out(`${tfName} v1.17.2 (practice world)`);
    return done(0);
  }
  if (!env) {
    record(false, null);
    err(
      `Error: No configuration files. Run ${tool} from terraform/envs/dev or terraform/envs/prod, or pass -chdir.`,
    );
    return done(1);
  }
  const home = instance();
  const show = (changes: Change[]) => {
    for (const c of changes) {
      const verb = c.actions.includes("delete")
        ? "will be destroyed"
        : c.actions.includes("create")
          ? "will be created"
          : "will be updated in-place";
      const mark = c.actions.includes("delete") ? "-" : c.actions.includes("create") ? "+" : "~";
      out(`  # ${c.address} ${verb}`);
      for (const d of c.diff) out(`      ${mark} ${d}`);
      if (!c.diff.length) out(`    ${mark} resource "${c.type}"`);
    }
    const n = (a: string) => changes.filter((c) => c.actions.includes(a)).length;
    out(
      changes.length
        ? `\nPlan: ${n("create")} to add, ${n("update")} to change, ${n("delete")} to destroy.`
        : "No changes. Your infrastructure matches the configuration.",
    );
  };
  const planJson = (changes: Change[]) => ({
    format_version: "1.2",
    terraform_version: "1.17.2",
    env,
    resource_changes: changes.map((c) => ({
      address: c.address,
      mode: "managed",
      type: c.type,
      name: c.address.split(".").pop(),
      change: { actions: c.actions, before: c.before, after: c.after },
    })),
  });
  try {
    switch (cmd) {
      case "init":
        record(false, env);
        out(`${tfName} has been successfully initialized!`);
        return done(0);
      case "validate":
        record(false, env);
        plan(env, home);
        out("Success! The configuration is valid.");
        return done(0);
      case "fmt":
        record(false, env);
        return done(0);
      case "plan": {
        const changes = plan(env, home, has(rest, "-destroy"));
        const logs = join(home, "logs");
        mkdirSync(logs, { recursive: true });
        writeFileSync(
          join(logs, `plan-${env}.json`),
          JSON.stringify(planJson(changes), null, 2) + "\n",
        );
        const o = rest.find((a) => a.startsWith("-out="));
        if (o)
          writeFileSync(
            resolve(cwd, o.slice(5)),
            JSON.stringify(planJson(changes), null, 2) + "\n",
          );
        record(false, env, { changes: changes.length });
        show(changes);
        return done(has(rest, "-detailed-exitcode") && changes.length ? 2 : 0);
      }
      case "show": {
        record(false, env);
        const f = positional(rest)[0];
        if (!f || !existsSync(resolve(cwd, f))) {
          err("Error: no saved plan file given");
          return done(1);
        }
        out(readFileSync(resolve(cwd, f), "utf8").trim());
        return done(0);
      }
      case "apply":
      case "destroy": {
        const changes = plan(env, home, cmd === "destroy");
        show(changes);
        const yes = has(rest, "-auto-approve") || process.env.TALLOWMARK_CONFIRM === "yes";
        if (!yes) {
          record(false, env, { refused: "no approval" });
          out(`\nApply cancelled. Run with -auto-approve, or type yes when a person approves.`);
          return done(1);
        }
        applyPlan(env, changes, home);
        record(true, env, { changes: changes.map((c) => `${c.actions.join("+")} ${c.address}`) });
        out(
          `\n${cmd === "destroy" ? "Destroy" : "Apply"} complete! Resources: ${changes.length} changed.`,
        );
        return done(0);
      }
      case "state": {
        const [sub, addr] = rest;
        if (sub === "list") {
          record(false, env);
          for (const a of Object.keys(loadCloud(env, home))) out(a);
          return done(0);
        }
        if (sub === "rm" && addr) {
          const c = loadCloud(env, home);
          delete c[addr];
          saveCloud(env, c, home);
          record(true, env);
          out(`Removed ${addr}`);
          return done(0);
        }
        break;
      }
    }
  } catch (e) {
    record(false, env, { error: (e as Error).message });
    err(`Error: ${(e as Error).message}`);
    return done(1);
  }
  record(false, env);
  err(
    `${tool} ${cmd}: not part of the practice world. Supported: init, validate, fmt, plan, show, apply, destroy, state list, state rm.`,
  );
  return done(1);
}

// ---------- kubectl ----------
const NS: Record<string, string> = { "seat-api": "seat", "waiting-room": "queue" };
function pods(env: Env) {
  const cl = loadCluster(env);
  const rows: { ns: string; name: string; status: string; restarts: number }[] = [];
  for (const [name, r] of Object.entries(cl.releases)) {
    const v = r.values;
    const broken = Number(v.probe?.port) !== Number(v.containerPort);
    for (let i = 0; i < Number(v.replicaCount ?? 1); i++)
      rows.push({
        ns: NS[name] ?? "default",
        name: `${name}-${r.revision}${i}x7`,
        status: broken ? "CrashLoopBackOff" : "Running",
        restarts: broken ? 14 : 0,
      });
  }
  for (const [name, h] of Object.entries(cl.hpa))
    if (cl.namespaces.includes("scan"))
      for (let i = 0; i < h.minReplicas; i++)
        rows.push({ ns: "scan", name: `${name}-${i}q2`, status: "Running", restarts: 0 });
  return rows;
}
function kubectl(args: string[]) {
  const ctx = flag(args, "--context") ?? process.env.KUBE_CONTEXT ?? "kind-tallowmark-prod";
  const env = envOf(ctx);
  if (!env) {
    record(false, null);
    err(`error: context "${ctx}" does not exist. Use kind-tallowmark-dev or kind-tallowmark-prod.`);
    return done(1);
  }
  const p = positional(args, ["--context", "-n", "--namespace", "-l", "-o", "--replicas"]);
  const ns = flag(args, "-n", "--namespace");
  const all = has(args, "-A", "--all-namespaces");
  const [verb, kind, name] = p;
  const cl = loadCluster(env);
  const mutate = (what: string) => {
    record(true, env, { context: ctx });
    out(what);
    return done(0);
  };
  switch (verb) {
    case "config":
      record(false, env);
      out(ctx);
      return done(0);
    case "get":
    case "describe":
    case "logs":
      record(false, env, { context: ctx });
      if (kind === "nodes") {
        out("NAME                         STATUS   ROLES           VERSION");
        out(`tallowmark-${env}-control-plane   Ready    control-plane   v1.37.2`);
        return done(0);
      }
      if (kind === "ns" || kind === "namespaces") {
        out("NAME     STATUS");
        for (const n of cl.namespaces) out(`${n.padEnd(8)} Active`);
        return done(0);
      }
      if (verb === "logs") {
        out("listening on :8080");
        return done(0);
      }
      {
        const rows = pods(env).filter((r) => all || r.ns === (ns ?? "default"));
        out(`${all ? "NAMESPACE  " : ""}NAME                   STATUS             RESTARTS`);
        for (const r of rows)
          out(
            `${all ? r.ns.padEnd(11) : ""}${r.name.padEnd(23)}${r.status.padEnd(19)}${r.restarts}`,
          );
        if (!rows.length) out(`No resources found in ${ns ?? "default"} namespace.`);
        return done(0);
      }
    case "delete":
      if (kind === "ns" || kind === "namespace") {
        cl.namespaces = cl.namespaces.filter((n) => n !== name);
        for (const [r] of Object.entries(cl.releases)) if (NS[r] === name) delete cl.releases[r];
        if (name === "scan") cl.hpa = {};
        saveCluster(env, cl);
        return mutate(`namespace "${name}" deleted`);
      }
      return mutate(`${kind} "${name ?? "selected"}" deleted`);
    case "scale":
    case "drain":
    case "apply":
    case "patch":
    case "edit":
    case "cordon":
    case "rollout":
    case "exec":
      return mutate(`${verb} done on ${ctx}`);
    case "version":
      record(false, env);
      out("Client Version: v1.37.2 (practice world)");
      return done(0);
  }
  record(false, env);
  err(
    `kubectl ${verb ?? ""}: not part of the practice world. Supported: get, describe, logs, delete, scale, drain, apply, config.`,
  );
  return done(1);
}

// ---------- helm ----------
const yaml = (p: string) => Bun.YAML.parse(readFileSync(p, "utf8")) as any;
export function renderChart(
  chartDir: string,
  values = yaml(join(chartDir, "values.yaml")),
): string {
  const tpl = readFileSync(join(chartDir, "templates", "deployment.yaml"), "utf8");
  const get = (path: string) =>
    path
      .split(".")
      .filter(Boolean)
      .reduce((o: any, k) => o?.[k], values);
  return tpl
    .replace(/\{\{\s*toYaml \.Values\.([\w.]+)\s*\|\s*nindent \d+\s*\}\}/g, (_, k) =>
      JSON.stringify(get(k) ?? {}),
    )
    .replace(/\{\{\s*\.Values\.([\w.]+)\s*\}\}/g, (_, k) => String(get(k)));
}
function helm(args: string[]) {
  const ctx = flag(args, "--kube-context") ?? process.env.KUBE_CONTEXT ?? "kind-tallowmark-prod";
  const env = envOf(ctx);
  if (!env) {
    record(false, null);
    err(`Error: context "${ctx}" does not exist`);
    return done(1);
  }
  const p = positional(args, ["--kube-context", "-n", "--namespace", "-f", "--values", "--set"]);
  const [verb, a, b] = p;
  const cl = loadCluster(env);
  switch (verb) {
    case "version":
      record(false, env);
      out("v4.3.1 (practice world)");
      return done(0);
    case "list":
    case "ls":
      record(false, env, { context: ctx });
      out("NAME          NAMESPACE  REVISION  CHART");
      for (const [n, r] of Object.entries(cl.releases))
        out(
          `${n.padEnd(14)}${(NS[n] ?? "default").padEnd(11)}${String(r.revision).padEnd(10)}${r.chart}`,
        );
      return done(0);
    case "lint": {
      record(false, env);
      const dir = resolve(a ?? ".");
      const chart = existsSync(join(dir, "Chart.yaml")) ? yaml(join(dir, "Chart.yaml")) : null;
      if (!chart || chart.apiVersion !== "v2" || !chart.name || !chart.version) {
        out(
          `[ERROR] Chart.yaml: missing or not apiVersion v2\nError: 1 chart(s) linted, 1 chart(s) failed`,
        );
        return done(1);
      }
      try {
        yaml(join(dir, "values.yaml"));
      } catch (e) {
        out(
          `[ERROR] values.yaml: ${(e as Error).message}\nError: 1 chart(s) linted, 1 chart(s) failed`,
        );
        return done(1);
      }
      out(
        `==> Linting ${a ?? "."}\n[INFO] Chart.yaml: icon is recommended\n\n1 chart(s) linted, 0 chart(s) failed`,
      );
      return done(0);
    }
    case "template": {
      record(false, env);
      const dir = resolve(b ?? a ?? ".");
      out(renderChart(dir));
      return done(0);
    }
    case "upgrade":
    case "install": {
      const name = a,
        dir = resolve(b ?? ".");
      if (!existsSync(join(dir, "Chart.yaml"))) {
        record(false, env);
        err(`Error: no chart at ${b}`);
        return done(1);
      }
      const chart = yaml(join(dir, "Chart.yaml"));
      const prev = cl.releases[name];
      cl.releases[name] = {
        chart: `${chart.name}-${chart.version}`,
        revision: (prev?.revision ?? 0) + 1,
        values: yaml(join(dir, "values.yaml")),
      };
      saveCluster(env, cl);
      record(true, env, { context: ctx });
      out(
        `Release "${name}" has been upgraded. Happy Helming!\nREVISION: ${cl.releases[name].revision}`,
      );
      return done(0);
    }
    case "uninstall":
    case "delete":
    case "rollback": {
      if (verb !== "rollback") delete cl.releases[a];
      saveCluster(env, cl);
      record(true, env, { context: ctx });
      out(verb === "rollback" ? `Rollback was a success.` : `release "${a}" uninstalled`);
      return done(0);
    }
  }
  record(false, env);
  err(
    `helm ${verb ?? ""}: not part of the practice world. Supported: list, lint, template, upgrade, uninstall, rollback.`,
  );
  return done(1);
}

// ---------- aws ----------
function aws(args: string[]) {
  const profile = flag(args, "--profile") ?? process.env.AWS_PROFILE ?? "tallowmark-prod";
  const env = envOf(profile);
  if (!env) {
    record(false, null);
    err(`The config profile (${profile}) could not be found`);
    return done(255);
  }
  const p = positional(args, [
    "--profile",
    "--bucket",
    "--versioning-configuration",
    "--region",
    "--output",
  ]);
  const [svc, op, target] = p;
  const bucket = flag(args, "--bucket") ?? target?.replace(/^s3:\/\//, "").split("/")[0];
  const cloud = loadCloud(env);
  const find = (type: string) =>
    Object.values(cloud).find((r) => r.type === type && r.attrs.bucket === bucket);
  const mutate = (msg: string) => {
    saveCloud(env, cloud);
    record(true, env, { profile });
    out(msg);
    return done(0);
  };
  if (svc === "sts" && op === "get-caller-identity") {
    record(false, env);
    out(
      JSON.stringify(
        {
          Account: env === "prod" ? "000000000002" : "000000000001",
          Arn: `arn:aws:iam::practice:user/${profile}`,
        },
        null,
        2,
      ),
    );
    return done(0);
  }
  if (svc === "s3" && op === "ls") {
    record(false, env);
    for (const r of Object.values(cloud).filter((r) => r.type === "aws_s3_bucket"))
      out(`practice ${r.attrs.bucket}`);
    return done(0);
  }
  if (svc === "s3api" && op === "get-bucket-versioning") {
    record(false, env);
    const v = find("aws_s3_bucket_versioning") as any;
    out(
      JSON.stringify(
        { Status: v?.attrs.versioning_configuration?.[0]?.status ?? "Suspended" },
        null,
        2,
      ),
    );
    return done(0);
  }
  if (svc === "s3api" && op === "get-public-access-block") {
    record(false, env);
    const b = find("aws_s3_bucket_public_access_block");
    if (!b) {
      err("An error occurred (NoSuchPublicAccessBlockConfiguration)");
      return done(254);
    }
    const a = b.attrs as any;
    out(
      JSON.stringify(
        {
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: a.block_public_acls,
            IgnorePublicAcls: a.ignore_public_acls,
            BlockPublicPolicy: a.block_public_policy,
            RestrictPublicBuckets: a.restrict_public_buckets,
          },
        },
        null,
        2,
      ),
    );
    return done(0);
  }
  if (svc === "s3api" && op === "put-bucket-versioning") {
    const v = find("aws_s3_bucket_versioning") as any;
    const status =
      /Status=(\w+)/.exec(flag(args, "--versioning-configuration") ?? "")?.[1] ?? "Enabled";
    if (v) v.attrs.versioning_configuration = [{ status }];
    return mutate("");
  }
  if (svc === "s3api" && op === "delete-public-access-block") {
    const b = find("aws_s3_bucket_public_access_block") as any;
    if (b)
      for (const k of [
        "block_public_acls",
        "block_public_policy",
        "ignore_public_acls",
        "restrict_public_buckets",
      ])
        b.attrs[k] = false;
    return mutate("");
  }
  if (svc === "s3" && op === "rb") {
    for (const [k, r] of Object.entries(cloud)) if (r.attrs.bucket === bucket) delete cloud[k];
    return mutate(`remove_bucket: ${bucket}`);
  }
  if (svc === "s3" && (op === "rm" || op === "cp" || op === "sync")) return mutate(`${op}: done`);
  record(false, env);
  err(
    `aws ${svc ?? ""} ${op ?? ""}: not part of the practice world. Supported: sts get-caller-identity, s3 ls, s3 rb, s3api get-bucket-versioning, s3api get-public-access-block.`,
  );
  return done(1);
}

if (import.meta.main) {
  switch (tool) {
    case "terraform":
    case "tofu":
      terraform(argv);
      break;
    case "kubectl":
      kubectl(argv);
      break;
    case "helm":
      helm(argv);
      break;
    case "aws":
      aws(argv);
      break;
    default:
      err(`unknown tool ${tool}`);
      done(2);
  }
}
