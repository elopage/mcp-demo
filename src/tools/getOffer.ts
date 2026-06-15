import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Deps } from "../deps.js";
import { euro, textResult } from "../format.js";

export function registerGetOffer(server: McpServer, deps: Deps): void {
  server.registerTool(
    "ablefy_get_offer",
    {
      title: "Get coach pricing offer",
      description:
        "Get the full offer for a coach: both payment modes and how each is paid. " +
        "Call after ablefy_find_coach when the user wants details before committing.",
      inputSchema: {
        product_id: z.string().describe("The coach's product_id from ablefy_find_coach."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ product_id }) => {
      const coach = await deps.backend.getCoach(product_id);
      if (!coach) return textResult(`No coach found for product_id ${product_id}.`);

      const text = [
        `**${coach.name}** — by ${coach.creator} (${coach.studio})`,
        coach.description,
        "",
        "**Two ways to pay:**",
        `1. **Micropayment** — ${euro(coach.pricePerQuestion, coach.currency)} per question, ` +
          `paid on-chain (rail: ${deps.rail.name}). Authorize once as a capped allowance up ` +
          `to ${euro(coach.monthlyCap, coach.currency)}/month, then ask freely within the cap.`,
        `2. **Flat** — ${euro(coach.flatPrice, coach.currency)} once for unlimited questions ` +
          `(comped order → ablefy access grant).`,
        "",
        `Tip: ${euro(coach.pricePerQuestion, coach.currency)} × 90 = ${euro(coach.monthlyCap, coach.currency)} — ` +
          "per-question usage converges on the flat price. Try one question first with ablefy_ask_coach.",
      ].join("\n");
      return textResult(text);
    },
  );
}
