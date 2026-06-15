import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Deps } from "../deps.js";
import { euro, textResult } from "../format.js";

export function registerPayFlat(server: McpServer, deps: Deps): void {
  server.registerTool(
    "ablefy_pay_flat",
    {
      title: "Pay the flat rate for unlimited access",
      description:
        "Pay the flat one-time price for unlimited questions to a coach. Comped on the " +
        "local ablefy backend (no real card): a confirmed order → access grant → " +
        "MembershipSession. After this, ablefy_ask_coach answers are free and uncapped.",
      inputSchema: {
        product_id: z.string().describe("The coach's product_id."),
        buyer_email: z.string().describe("Buyer's email — identifies the access holder."),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ product_id, buyer_email }) => {
      const coach = await deps.backend.getCoach(product_id);
      if (!coach) return textResult(`No coach found for product_id ${product_id}.`);

      let sessionId: string;
      try {
        ({ sessionId } = await deps.backend.grantFlatAccess(product_id, buyer_email));
      } catch (e) {
        // The grant writes a real ablefy row; surface why it couldn't (e.g. an email
        // ablefy's validator rejects, or the local backend being down) instead of failing hard.
        return textResult(
          `Couldn't grant flat access: ${(e as Error).message}\n\n` +
            `Tip: use a deliverable email address (ablefy validates it), and make sure the local ablefy backend is running.`,
        );
      }
      await deps.earnings.record({
        productId: product_id,
        seller: coach.creator,
        mode: "flat",
        amount: coach.flatPrice,
        currency: coach.currency,
        buyerEmail: buyer_email,
        timestamp: new Date().toISOString(),
      });

      return textResult(
        `Flat access granted — **${euro(coach.flatPrice, coach.currency)}** comped order → real ` +
          `MembershipSession \`${sessionId}\` in ablefy's database.\n\nUnlimited questions for ` +
          `${buyer_email}, no per-question payment. Ask away with ablefy_ask_coach.`,
      );
    },
  );
}
