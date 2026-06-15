import type { Coach } from "../types.js";

/**
 * Generates the coach's answer. Slice 1 = canned persona replies (FakeCoach);
 * slice 4 = a real LLM (Anthropic) behind this same interface.
 */
export interface CoachLLM {
  answer(coach: Coach, question: string): Promise<string>;
}
