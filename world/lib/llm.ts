// One way to ask a model for text. In replay mode it reads a recorded reply, so nothing needs a key.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { provider, modelFor, KEY_NAME, type Role } from "../../config/models";
import { WORLD } from "../sim/state";

export type Ask = { role: Role; system?: string; prompt: string; replayKey: string };
export type Answer = { text: string; provider: string; inputTokens: number; outputTokens: number };

function live(p: Exclude<ReturnType<typeof provider>, "replay">) {
  const keyName = KEY_NAME[p];
  const key = keyName ? process.env[keyName] : undefined;
  if (keyName && !key) throw new Error(`LLM_PROVIDER=${p} needs ${keyName} in .env. See .env.example.`);
  if (p === "anthropic") return createAnthropic({ apiKey: key });
  if (p === "openrouter") return createOpenRouter({ apiKey: key! });
  if (p === "openai") return createOpenAI({ apiKey: key });
  return createOpenAI({ baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1", apiKey: "ollama" });
}

export async function ask(a: Ask): Promise<Answer> {
  const p = provider();
  if (p === "replay") {
    const f = join(WORLD, "replay", `${a.replayKey}.json`);
    if (!existsSync(f)) throw new Error(`No recorded reply for "${a.replayKey}". Use a recorded case, or set LLM_PROVIDER and a key in .env.`);
    const r = JSON.parse(readFileSync(f, "utf8"));
    return { text: r.text, provider: "replay", inputTokens: 0, outputTokens: 0 };
  }
  const client = live(p);
  const res = await generateText({ model: (client as any)(modelFor(a.role, p)), system: a.system, prompt: a.prompt, maxOutputTokens: 600 });
  return { text: res.text, provider: p, inputTokens: res.usage?.inputTokens ?? 0, outputTokens: res.usage?.outputTokens ?? 0 };
}
