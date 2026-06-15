// Ask the coach one question directly. Run: npm run coach:test "your question"
// COACH_LLM=anthropic + ANTHROPIC_API_KEY in .env → real model; else the canned coach.
import { loadConfig } from "../dist/config.js";
import { AnthropicCoach } from "../dist/coach/anthropicCoach.js";
import { OpenAICompatibleCoach } from "../dist/coach/openaiCoach.js";
import { FakeCoach } from "../dist/coach/fakeCoach.js";

const cfg = loadConfig();
const coach = {
  productId: "1",
  slug: cfg.coachSlug,
  name: "Lena AI — Systems Coach",
  creator: "Lena Brandt",
  studio: "The Systems Studio",
  description:
    "An AI coach trained on Lena Brandt's second-brain method — capture, weekly review, " +
    "and a Notion/Obsidian system that actually sticks.",
  pricePerQuestion: cfg.pricePerQ,
  monthlyCap: cfg.monthlyCap,
  flatPrice: cfg.monthlyCap,
  currency: cfg.currency,
};

const llm =
  cfg.coachLlm === "anthropic"
    ? new AnthropicCoach(cfg)
    : cfg.coachLlm === "litellm"
      ? new OpenAICompatibleCoach(cfg)
      : new FakeCoach();
const question = process.argv[2] || "How should I structure capture on mobile vs my weekly review?";

console.log(`coach=${cfg.coachLlm} model=${cfg.coachModel}`);
console.log(`Q: ${question}\n`);
console.log(`A: ${await llm.answer(coach, question)}`);
