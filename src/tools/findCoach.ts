import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Deps } from "../deps.js";
import { euro, textResult } from "../format.js";

export function registerFindCoach(server: McpServer, deps: Deps): void {
  server.registerTool(
    "ablefy_find_coach",
    {
      title: "Find an AI coach",
      description:
        "Find a creator's AI coach that the user can pay to ask questions. Use this " +
        "when the user wants expert help on a topic (e.g. productivity, second-brain / " +
        "note systems) and is open to asking a specialist's AI coach. Returns the " +
        "coach(es) with both payment options: a per-question micropayment and a flat rate.",
      inputSchema: {
        query: z.string().optional().describe("What the user needs help with, in their words."),
        slug: z.string().optional().describe("A specific creator/shop slug, if known."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, slug }) => {
      const coaches = await deps.backend.findCoaches({ query, slug });
      if (coaches.length === 0) return textResult("No AI coaches found for that request.");

      const blocks = coaches.map((c) =>
        [
          `**${c.name}** — by ${c.creator} (${c.studio})`,
          c.description,
          `Pay **${euro(c.pricePerQuestion, c.currency)}/question** (capped ${euro(c.monthlyCap, c.currency)}/month) ` +
            `or **${euro(c.flatPrice, c.currency)} flat** for unlimited.`,
          `\`product_id\`: ${c.productId}`,
        ].join("\n"),
      );
      return textResult(blocks.join("\n\n---\n\n"));
    },
  );
}
