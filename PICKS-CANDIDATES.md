# Picks candidates

For the page pass. Cut each part to 4 to 6 picks, at least 2 videos, then delete this file. Every row is from the
person or team who made the method or runs it. I could not open links from the build session, so run the oEmbed and
live-link check on each before you keep it. Titles are as I know them; correct them on the page. Kind is V for video
and R for read.

## Orientation

| # | Kind | Author, year | Title | Why it passes the bar |
|---|---|---|---|---|
| 1 | R | Anthropic, ongoing | Claude Code overview and quickstart (official docs) | Official docs from the makers. Evergreen: what the tool is |
| 2 | R | Anthropic, 2025 | Claude Code: best practices for agentic coding (engineering blog) | Written by the team that builds it. About habits, not a launch |
| 3 | R | Anthropic, 2025 | How Anthropic teams use Claude Code | The makers describe their own production use |
| 4 | V | Boris Cherny, Anthropic, 2025 | Claude Code talk from a major AI engineering conference | The creator of the tool, at a conference |
| 5 | R | Anthropic, ongoing | Claude Code common workflows (docs) | Official, task by task |
| 6 | R | Anthropic, 2024 | Building effective agents | The makers' core idea on agent design. Evergreen |
| 7 | V | Anthropic, 2025 | Code with Claude conference session on Claude Code | First-party conference talk |
| 8 | R | Simon Willison, 2025 | The lethal trifecta for AI agents | Independent expert who coined the idea. Frames why we fence |

## Part 01: fence the agent

| # | Kind | Author, year | Title | Why it passes the bar |
|---|---|---|---|---|
| 1 | R | Anthropic, ongoing | Claude Code permissions and settings (docs) | The rules and precedence, from the makers |
| 2 | R | Anthropic, ongoing | Claude Code hooks guide (docs) | The exact hook contract the checks use |
| 3 | R | Anthropic, 2025 | Beyond permission prompts: making Claude Code more secure and autonomous | Engineering blog on the sandbox, by the team that built it |
| 4 | R | Anthropic, ongoing | Claude Code sandboxing (docs) | Official, about the idea |
| 5 | R | Nx maintainers, 2025 | Nx package compromise advisory (GHSA-cxm3-wv7p-598c) | The project's own postmortem of the real incident in the problem text |
| 6 | R | Simon Willison, 2025 | The lethal trifecta for AI agents | Names the risk the fence answers |
| 7 | V | Boris Cherny, Anthropic, 2025 | Claude Code talk on permissions and safe use | The creator explains the model |
| 8 | R | OWASP, 2025 | OWASP Top 10 for LLM Applications | A standards body. Evergreen risk list |
| 9 | V | Anthropic, 2025 | Conference session on safe agent use | First-party talk |

## Part 02: teach the repo

| # | Kind | Author, year | Title | Why it passes the bar |
|---|---|---|---|---|
| 1 | R | Anthropic, ongoing | Claude Code memory and CLAUDE.md (docs) | Official, shows the load rules |
| 2 | R | Anthropic, 2025 | Equipping agents for the real world with Agent Skills | The makers' own post on skills |
| 3 | R | Anthropic, ongoing | Claude Code skills (docs) | Official, shows front matter and invocation |
| 4 | R | HashiCorp, ongoing | Terraform plan command and -detailed-exitcode (docs) | The tool's makers define the exit codes the check uses |
| 5 | R | HashiCorp, ongoing | Terraform: manage drift (tutorial) | Official guide to drift |
| 6 | R | Helm project, ongoing | Helm chart best practices | The project's own guidance |
| 7 | R | Google SRE, 2016 | Site Reliability Engineering: Being on-call | Written by the team that runs it at scale. Evergreen |
| 8 | V | Anthropic, 2025 | Conference session on context and memory for coding agents | First-party talk |
| 9 | R | Anthropic, 2025 | Effective context engineering for AI agents | Makers' post on what to put in context |

## Part 03: give it eyes

| # | Kind | Author, year | Title | Why it passes the bar |
|---|---|---|---|---|
| 1 | R | Kubernetes project, ongoing | Using RBAC authorization (docs) | Official; the reader role comes from here |
| 2 | R | Model Context Protocol project, ongoing | MCP introduction and specification | The protocol authors' docs |
| 3 | R | Anthropic, ongoing | Claude Code MCP (docs) | Official, shows config and scopes |
| 4 | R | Anthropic, 2025 | Writing effective tools for agents | Makers' post, evergreen |
| 5 | R | Anthropic, 2025 | How we built our multi-agent research system | Makers describe running subagents in production |
| 6 | R | Anthropic, ongoing | Claude Code subagents (docs) | Official, shows tools and descriptions |
| 7 | R | Rob Ewaschuk, Google, 2013 | My philosophy on alerting | A Google SRE's well-known piece, still taught |
| 8 | R | Google SRE, 2018 | The SRE Workbook: alerting on SLOs | Google runs this in production |
| 9 | R | Google SRE, 2016 | Managing incidents | The method, by the team that runs it |
| 10 | V | Conference talk on incident response from a major SRE conference | Incident triage with an agent in the loop | Pick one from a major conference after checking it live |

## Part 04: run it without you

| # | Kind | Author, year | Title | Why it passes the bar |
|---|---|---|---|---|
| 1 | R | Anthropic, ongoing | Claude Code headless mode (docs) | Official source for `claude -p` |
| 2 | R | Anthropic, ongoing | Claude Code GitHub Actions (docs) | Official source for the Action |
| 3 | R | GitHub, ongoing | Security hardening for GitHub Actions | The platform's own guide to pinning and permissions |
| 4 | R | GitHub, ongoing | About security hardening with OpenID Connect | The platform's own guide for OIDC |
| 5 | R | AWS, ongoing | Configure AWS credentials for GitHub Actions | Official, shows the role step |
| 6 | R | GitHub Security Lab, 2021 | Keeping your GitHub Actions and workflows secure: preventing pwn requests | The security team that finds these bugs |
| 7 | R | Anthropic, ongoing | Claude Code development containers (docs) | Official firewall and container guide |
| 8 | R | Anthropic, ongoing | Claude Code monitoring usage with OpenTelemetry (docs) | Official list of env vars |
| 9 | R | OpenTelemetry project, ongoing | OpenTelemetry concepts | The standard's own docs. Evergreen |
| 10 | V | Boris Cherny, Anthropic, 2025 | Talk on running Claude Code in parallel and unattended | The creator, on worktrees and automation |
| 11 | R | Anthropic, ongoing | Claude Code hooks: the Stop hook (docs) | Official source for the gate |

## Part 05: check infrastructure rules with Conftest

| # | Kind | Author, year | Title | Why it passes the bar |
|---|---|---|---|---|
| 1 | R | Conftest project (Open Policy Agent), ongoing | Conftest docs | The tool's own docs |
| 2 | R | Open Policy Agent project, ongoing | Policy language (Rego) reference | The language authors |
| 3 | R | Open Policy Agent project, ongoing | OPA and Terraform guide | Official guide for plan checks |
| 4 | R | HashiCorp, ongoing | Terraform JSON output format | Defines the plan the policy reads |
| 5 | V | Torin Sandall, OPA creator, 2019 | OPA introduction at a CNCF conference | Talk by a creator of the method |
| 6 | V | Open Policy Agent maintainers, various | Policy as code talks at KubeCon | CNCF conference talks by maintainers |
| 7 | R | CNCF, ongoing | Open Policy Agent project page | Graduated project page |
| 8 | R | Anthropic, 2025 | Writing effective tools for agents | Why a policy gives an agent a clear stop |
