# How Claude Code got to this answer

This folder is the end state. Claude Code wrote the RBAC file, the reader kubeconfig, the MCP settings and the deny
rules. You typed one prompt, read the plan, and asked about the ClusterRole before you said yes.

## Prompt 1: give it eyes, not hands

```text
Work in parts/03-give-it-eyes/01-connect-the-cluster-read-only/problem/.
1. Write k8s/claude-reader.yaml: a ServiceAccount claude-reader in namespace ops,
   a ClusterRole that may only get, list and watch pods, pods/log, services, events,
   namespaces, nodes, configmaps, deployments, replicasets and horizontalpodautoscalers,
   and a ClusterRoleBinding. No secrets, and no "*" anywhere.
2. Write kubeconfig/claude-reader.yaml with contexts kind-tallowmark-dev and
   kind-tallowmark-prod, both using the user claude-reader with a practice token.
3. Read https://github.com/containers/kubernetes-mcp-server. Write mcp/kubernetes.toml
   with read_only = true and kubeconfig = "kubeconfig/claude-reader.yaml",
   and .mcp.json with a server named kubernetes that runs
   npx -y kubernetes-mcp-server@0.1.2 --config mcp/kubernetes.toml.
4. In .claude/settings.json, add deny rules for each kubernetes write tool:
   the delete tools, pods_exec, pods_run, resources_create_or_update,
   resources_scale, helm_install and helm_uninstall. Keep the hook as it is.
Show me your plan first.
```

## The plan Claude Code shows

The words change from run to run. A good plan has these points:

1. One YAML file with three documents: the ServiceAccount, the ClusterRole and the binding.
2. The ClusterRole lists each resource by name, with the verbs `get`, `list` and `watch` only.
3. A kubeconfig with two contexts and one user, `claude-reader`, holding a token.
4. A TOML file with `read_only = true`, and `.mcp.json` that passes it with `--config`.
5. New deny rules such as `mcp__kubernetes__*_delete` and `mcp__kubernetes__pods_exec`.

## What you check before you say yes

- No `"*"` in verbs. The `wrong/read-only-flag-only` answer trusts `read_only` and gives the role `*`.
- No `"*"` in resources. The `wrong/reads-secrets` answer can read every secret in the cluster.
- The TOML file points at the reader kubeconfig. The `wrong/admin-kubeconfig` answer uses `~/.kube/config`.
- The deny rules name write tools only. A rule for all of `mcp__kubernetes` would take away the eyes too.

## Ask what the reader can do

```bash
bun checks/helpers/03-give-it-eyes/rbac.ts parts/03-give-it-eyes/01-connect-the-cluster-read-only/solution delete pods
bun checks/helpers/03-give-it-eyes/rbac.ts parts/03-give-it-eyes/01-connect-the-cluster-read-only/solution list pods
```

Expect: `no`, then `yes`.

## Then run the check

```bash
bun run verify connect-the-cluster-read-only
```

Expect: `Done. All 9 rules pass.`
