import Anthropic from "@anthropic-ai/sdk";
import type { Coach } from "../types.js";
import type { CoachLLM } from "./coach.js";
import type { Config } from "../config.js";
import { systemPrompt } from "./persona.js";

/**
 * Real coach (slice 4): answers come from a live Anthropic model in Lena's voice.
 * Selected by COACH_LLM=anthropic; falls back to FakeCoach otherwise. The system
 * prompt embeds the persona + method so answers stay on-brand and useful.
 */
export class AnthropicCoach implements CoachLLM {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(cfg: Config) {
    if (!cfg.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is required for COACH_LLM=anthropic");
    this.client = new Anthropic({ apiKey: cfg.anthropicApiKey });
    this.model = cfg.coachModel;
  }

  async answer(coach: Coach, question: string): Promise<string> {
    const system = systemPrompt(coach);

    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: question }],
    });

    const text = msg.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    if (!text) throw new Error("Anthropic returned an empty answer");
    return text;
  }
}
