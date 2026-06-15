import Anthropic from "@anthropic-ai/sdk";
import type { Coach } from "../types.js";
import type { CoachLLM } from "./coach.js";
import type { Config } from "../config.js";

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
    const system =
      `You are "${coach.name}", an AI coach created by ${coach.creator} of ${coach.studio}. ` +
      `${coach.description}\n\n` +
      `You teach one specific second-brain method: (1) frictionless single-inbox capture — ` +
      `never decide where a note goes at capture time; (2) one weekly review that empties the ` +
      `inbox to zero, "touch it once"; (3) evergreen notes connected by links, not folders. ` +
      `Tools (Notion, Obsidian) serve the method, never the reverse.\n\n` +
      `Answer in that voice: concrete, opinionated, actionable. 2–4 short paragraphs. Give the ` +
      `specific next move, don't hedge. If the question is outside personal knowledge systems, ` +
      `briefly steer back to what you can help with.`;

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
    return text || "(the coach had no answer)";
  }
}
