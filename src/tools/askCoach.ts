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
        "Ask the creator's AI coach one question. Consent is required first: FLAT buyers ask " +
        "free; otherwise the buyer must have authorized a per-question allowance with " +
        "ablefy_authorize_allowance. If they haven't, this returns the pricing and asks them to " +
        "authorize (or ablefy_pay_flat) BEFORE any charge — there is no silent trial. Once " +
        "authorized, it takes the per-question micropayment on-chain within the monthly cap. " +
        "Returns the answer plus the payment proof and remaining cap.",
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
      const { pricePerQuestion: price, currency } = coach;
      // Use the buyer-chosen cap (set at authorize) if present, else the coach default.
      const cap = deps.meter.capFor(product_id, coach.monthlyCap);

      // Flat (unlimited) — no per-question charge.
      if (await deps.backend.hasFlatAccess(product_id, buyer)) {
        const answer = await deps.coach.answer(coach, question);
        return textResult(`*(flat · unlimited)*\n\n${answer}`);
      }

      // Micro path. Require explicit pricing + allowance consent before the FIRST paid answer —
      // no silent trial. This surfaces the agent-commerce consent beat: show the cost, get the
      // monthly cap authorized, then ask freely up to it.
      const authorized = deps.meter.isAuthorized(product_id);

      if (!authorized) {
        return textResult(
          `Before I ask Lena: she answers for **${euro(price, currency)}/question**, capped at ` +
            `**${euro(cap, currency)}/month** — or **${euro(coach.flatPrice, currency)} flat** for ` +
            `unlimited. Authorize the per-question allowance with **ablefy_authorize_allowance** ` +
            `(you approve once, then ask freely up to the cap), or go unlimited with ` +
            `**ablefy_pay_flat**.`,
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

      // Idempotency: if this exact question was charged moments ago (e.g. the model
      // re-asked), answer again but DON'T charge twice — and say so, by design.
      const priorCharge = deps.meter.findRecentCharge(product_id, question, 2 * 60 * 1000);
      if (priorCharge) {
        const left = deps.meter.remaining(product_id, cap);
        return textResult(
          `${answer}\n\n*😊 You already paid ${euro(price, currency)} for this exact question a moment ago, ` +
            `so this one's on the house — no double charge. (Original payment: tx \`${priorCharge.txId}\`.) ` +
            `${euro(left, currency)} still left of your ${euro(cap, currency)} cap.*`,
        );
      }

      // Answer in hand, not a duplicate → take the micropayment and book the earning.
      const receipt = await deps.rail.charge(price, currency, `${coach.name}: ${question.slice(0, 48)}`);
      deps.meter.recordCharge(product_id, price, receipt.txId, price, cap, question);
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
        `💸 **Paid ${euro(price, currency)}${onchain} on-chain** via ${receipt.rail} — tx \`${receipt.txId}\`` +
        (receipt.explorerUrl ? `\n🔗 Verify: ${receipt.explorerUrl}` : "");
      const footer = `\n\n*(${euro(remaining, currency)} left of your ${euro(cap, currency)} monthly cap.)*`;
      return textResult(`${proof}\n\n${answer}${footer}`);
    },
  );
}
