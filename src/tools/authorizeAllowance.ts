import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Deps } from "../deps.js";
import { euro, textResult } from "../format.js";

export function registerAuthorizeAllowance(server: McpServer, deps: Deps): void {
  server.registerTool(
    "ablefy_authorize_allowance",
    {
      title: "Authorize a capped spend allowance",
      description:
        "Authorize the bounded micropayment allowance for a coach: a per-question price " +
        "capped at a monthly ceiling. This is the buyer's single bounded mandate — approve " +
        "once and subsequent ablefy_ask_coach charges flow within the cap without re-approval. " +
        "Not an open-ended spend: the meter refuses charges past the cap.",
      inputSchema: {
        product_id: z.string().describe("The coach's product_id."),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ product_id }) => {
      const coach = await deps.backend.getCoach(product_id);
      if (!coach) return textResult(`No coach found for product_id ${product_id}.`);

      const allowanceId = deps.meter.authorize(product_id, coach.pricePerQuestion, coach.monthlyCap);
      const remaining = deps.meter.remaining(product_id, coach.monthlyCap);
      return textResult(
        `Allowance authorized: **${euro(coach.pricePerQuestion, coach.currency)}/question**, ` +
          `capped at **${euro(coach.monthlyCap, coach.currency)}/month** (id \`${allowanceId}\`).\n\n` +
          `You can now ask freely with ablefy_ask_coach — ${euro(remaining, coach.currency)} remaining ` +
          `this month — without approving each question. The cap is a hard ceiling.`,
      );
    },
  );
}
