// The only file that names a model. Code asks for a role, never an id.
// LLM_PROVIDER picks the provider: replay (the default, no key), anthropic, openrouter, openai or ollama.
export type Role = "fast" | "smart" | "judge";
export type Provider = "replay" | "anthropic" | "openrouter" | "openai" | "ollama";

export const PROVIDERS: Provider[] = ["replay", "anthropic", "openrouter", "openai", "ollama"];

export const MODELS: Record<Exclude<Provider, "replay">, Record<Role, string>> = {
  anthropic: { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5", judge: "claude-haiku-5-5" },
  openrouter: { fast: "nvidia/nemotron-3.5-lightning", smart: "anthropic/claude-sonnet-5.5", judge: "anthropic/claude-haiku-5.5" },
  openai: { fast: "gpt-6-luna", smart: "gpt-6-luna-pro", judge: "gpt-6-luna" },
  ollama: { fast: "qwen3:8b", smart: "qwen3:32b", judge: "qwen3:8b" },
};

// The key each provider reads from the git-ignored .env. Never printed.
export const KEY_NAME: Record<Exclude<Provider, "replay">, string | null> = {
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  ollama: null,
};

export function provider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? "replay") as Provider;
  if (!PROVIDERS.includes(p)) throw new Error(`LLM_PROVIDER="${p}" is not one of: ${PROVIDERS.join(", ")}`);
  return p;
}

export const modelFor = (role: Role, p: Provider = provider()) => (p === "replay" ? `replay:${role}` : MODELS[p][role]);
