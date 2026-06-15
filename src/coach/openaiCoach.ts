import type { Coach } from "../types.js";
import type { CoachLLM } from "./coach.js";
import type { Config } from "../config.js";
import { systemPrompt } from "./persona.js";

/**
 * Coach backed by any OpenAI-compatible chat endpoint — notably a LiteLLM proxy
 * fronting Claude models (selected by COACH_LLM=litellm). No SDK: a plain POST to
 * `{LLM_BASE_URL}/chat/completions`. Use this when you have a proxy/gateway rather
 * than a direct Anthropic API key.
 */
export class OpenAICompatibleCoach implements CoachLLM {
  private readonly base: string;
  private readonly key: string;
  private readonly model: string;

  constructor(cfg: Config) {
    if (!cfg.llmBaseUrl) throw new Error("LLM_BASE_URL is required for COACH_LLM=litellm");
    this.base = cfg.llmBaseUrl.replace(/\/$/, "");
    this.key = cfg.llmApiKey;
    this.model = cfg.coachModel;
  }

  async answer(coach: Coach, question: string): Promise<string> {
    const res = await fetch(`${this.base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.key ? { authorization: `Bearer ${this.key}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt(coach) },
          { role: "user", content: question },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`LLM proxy ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json?.choices?.[0]?.message?.content;
    return (typeof text === "string" ? text.trim() : "") || "(the coach had no answer)";
  }
}
