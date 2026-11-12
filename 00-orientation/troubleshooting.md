# When something goes wrong

Every message a script prints on failure is in this table.

| What you see | What it means | Fix |
|---|---|---|
| `bun: command not found` | Bun is not installed. | Install Bun 1.4.4 from bun.sh, then open a new terminal. |
| `There is no step called "..."` | The step name is misspelled. | Copy a name from the list it prints. |
| `There is no part called "..."` | The part name is misspelled. | Copy a name from the list it prints, such as `fence-the-agent`. |
| `ERROR the check for ... could not load` | The check itself is broken, not your work. | Open an issue with the full output. |
| `FAIL ...` followed by `Try next: ...` | One rule of the step is not met yet. | Do what the Try next line says, then run the same command again. |
| `Unknown command "..."` from `bun run world` | `world` takes `reset`, `use <step-name>` or `status`. | Run `bun run world` with one of those. |
| `Name a step: bun run world use <step-name>` | `world use` needs a step name. | Add the step name, such as `write-the-deny-rules`. |
| `The step ... has no problem/.claude folder to use.` | That step does not change Claude Code settings. | Use a step from part one. |
| `Error: No configuration files. Run terraform from terraform/envs/dev or terraform/envs/prod, or pass -chdir.` | You ran `terraform` outside an environment folder. | `cd` into `terraform/envs/dev` or pass `-chdir=terraform/envs/dev`. |
| `Apply cancelled. Run with -auto-approve, or type yes when a person approves.` | The world's terraform wants an approval. | That is the point. A person applies, not the agent. |
| `error: context "..." does not exist` | kubectl or helm got a context the world does not have. | Use `kind-tallowmark-dev` or `kind-tallowmark-prod`. |
| `The config profile (...) could not be found` | `AWS_PROFILE` is not a world profile. | Use `tallowmark-dev` or `tallowmark-prod`. |
| `... not part of the practice world. Supported: ...` | The world's tools cover the commands this course uses, not every flag. | Use one of the listed commands. |
| `Blocked by guard-infra: ...` | A guard hook blocked a tool call. | Expected for dangerous calls. If it blocked a safe one, fix the hook. |
| `No recorded reply for "..."` | Replay mode has no recording for that request. | Use a recorded case, or set `LLM_PROVIDER` and one key in `.env`. |
| `LLM_PROVIDER=... needs ..._API_KEY in .env. See .env.example.` | You picked a live provider with no key. | Add the key to `.env`, or set `LLM_PROVIDER=replay`. |
| `LLM_PROVIDER="..." is not one of: ...` | The provider name is misspelled. | Use `replay`, `anthropic`, `openrouter`, `openai` or `ollama`. |
| `FAIL` on a role in `bun run models` | That provider did not answer. | Check the key in `.env` and your network, then run it again. |
| `The repo does not meet the standard.` | `bun run check` found a rule broken. | Fix each listed line. Authors only; learners do not need this. |
