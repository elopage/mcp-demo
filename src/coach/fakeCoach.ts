import type { Coach } from "../types.js";
import type { CoachLLM } from "./coach.js";

/**
 * Canned stand-in for Lena's coach (slice 1). Keyword-routes to a few answers in
 * her second-brain voice so the consume beat works without an LLM key. Slice 4
 * replaces this with a real model behind the same `CoachLLM` interface.
 */
export class FakeCoach implements CoachLLM {
  async answer(_coach: Coach, question: string): Promise<string> {
    const q = question.toLowerCase();

    if (/(capture|mobile|inbox|quick note)/.test(q)) {
      return [
        "Capture should be frictionless and single-destination. On mobile, one shortcut",
        "into a single 'Inbox' note — never decide where it goes at capture time. The",
        "sorting is a separate, scheduled act. If capture asks you to think, you'll stop",
        "capturing. Then your weekly review is the only place raw notes get processed.",
      ].join(" ");
    }
    if (/(weekly|review|process|sort)/.test(q)) {
      return [
        "Run one weekly review, same slot every week. Empty the Inbox to zero: each note",
        "gets deleted, filed into a project, or promoted to an evergreen note. The rule is",
        "'touch it once'. Ten focused minutes beats a daily trickle, because the value is",
        "in the connections you make while reviewing, not in the act of filing.",
      ].join(" ");
    }
    if (/(notion|obsidian|tool|app|setup|structure)/.test(q)) {
      return [
        "Tools are interchangeable; the method isn't. Use one capture inbox, a flat pool",
        "of evergreen notes, and project notes that link to them — not deep folder trees.",
        "Obsidian for thinking and linking, Notion for structured/shared databases. Pick",
        "based on whether your work is mostly linking ideas or tracking records.",
      ].join(" ");
    }
    return [
      "Start from the workflow, not the app: capture in one place, review weekly, and let",
      "evergreen notes accrete through links rather than folders. Tell me the specific",
      "friction point — capture, review, or retrieval — and I'll give you the exact move.",
    ].join(" ");
  }
}
