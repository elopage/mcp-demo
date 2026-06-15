import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Deps } from "../deps.js";
import { euro, textResult } from "../format.js";

const DEFAULT_BUYER = "guest@demo";

export function registerAskCoach(server: McpServer, deps: Deps): void {
  server.registerTool(
    "ablefy_ask_coach",
    {
      title: "Ask the coach a question",
      description:
        "Ask the creator's AI coach one question. Payment is automatic per the chosen " +
        "mode: FLAT buyers ask free; otherwise this takes the per-question micropayment " +
        "on-chain and enforces the monthly cap. The very first ask (before authorizing an " +
        "allowance) is the one-off paid TRIAL; further asks need ablefy_authorize_allowance " +
        "or ablefy_pay_flat. Returns the answer plus the payment proof and remaining cap.",
      inputSchema: {
        product_id: z.string().describe("The coach's product_id."),
        question: z.string().describe("The user's question for the coach."),
        buyer_email: z
          .string()
          .optional()
          .describe("Buyer's email (identifies a flat-access holder). Optional for micro."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ product_id, question, buyer_email }) => {
      const coach = await deps.backend.getCoach(product_id);
      if (!coach) return textResult(`No coach found for product_id ${product_id}.`);
      const buyer = buyer_email ?? DEFAULT_BUYER;
      const { pricePerQuestion: price, monthlyCap: cap, currency } = coach;

      // Flat (unlimited) — no per-question charge.
      if (await deps.backend.hasFlatAccess(product_id, buyer)) {
        const answer = await deps.coach.answer(coach, question);
        return textResult(`*(flat · unlimited)*\n\n${answer}`);
      }

      // Micro path. Gate repeated asks behind the bounded allowance.
      const authorized = deps.meter.isAuthorized(product_id);
      const used = deps.meter.chargesThisMonth(product_id);
      const isTrial = used === 0 && !authorized;

      if (!authorized && used >= 1) {
        return textResult(
          `You've used your free-to-start trial question. To keep asking, authorize ` +
            `${euro(price, currency)}/question (capped ${euro(cap, currency)}/month) with ` +
            `**ablefy_authorize_allowance**, or go **${euro(coach.flatPrice, currency)} flat** ` +
            `for unlimited with **ablefy_pay_flat**.`,
        );
      }
      if (!deps.meter.canCharge(product_id, price, cap)) {
        return textResult(
          `Monthly cap of ${euro(cap, currency)} reached. Go **${euro(coach.flatPrice, currency)} ` +
            `flat** for unlimited with **ablefy_pay_flat**.`,
        );
      }

      // Generate the answer FIRST — if the coach fails, the buyer must NOT be charged.
      let answer: string;
      try {
        answer = await deps.coach.answer(coach, question);
      } catch (err) {
        return textResult(
          `The coach couldn't answer just now, so you were **not** charged — please try again. ` +
            `(${(err as Error).message})`,
        );
      }

      // Answer in hand → take the micropayment and book the earning.
      const receipt = await deps.rail.charge(price, currency, `${coach.name}: ${question.slice(0, 48)}`);
      deps.meter.recordCharge(product_id, price, receipt.txId, price, cap);
      await deps.earnings.record({
        productId: product_id,
        seller: coach.creator,
        mode: "micro",
        amount: price,
        currency,
        buyerEmail: buyer,
        receipt,
        timestamp: new Date().toISOString(),
      });
      const remaining = deps.meter.remaining(product_id, cap);
      const onchain = receipt.assetAmount != null ? ` (${receipt.assetAmount} ${receipt.assetUnit})` : "";
      const proof =
        `Paid ${euro(price, currency)}${onchain} on-chain via ${receipt.rail} — tx \`${receipt.txId}\`` +
        (receipt.explorerUrl ? `\n${receipt.explorerUrl}` : "");
      const footer = isTrial
        ? `\n\n*(that was your trial — ${euro(remaining, currency)} left of the ${euro(cap, currency)} cap. ` +
          `Authorize the allowance to keep asking without re-approving each time.)*`
        : `\n\n*(${euro(remaining, currency)} left of your ${euro(cap, currency)} monthly cap.)*`;
      return textResult(`${proof}\n\n${answer}${footer}`);
    },
  );
}
