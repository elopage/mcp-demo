import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Deps } from "../deps.js";
import { euro, textResult } from "../format.js";

export function registerCreatorEarnings(server: McpServer, deps: Deps): void {
  server.registerTool(
    "ablefy_creator_earnings",
    {
      title: "Creator euro earnings",
      description:
        "Show the creator's euro earnings from agent-mediated sales — the view that " +
        "surfaces in the seller's ablefy-light console. Micro earnings are accumulated " +
        "per-question micropayments; flat earnings are the one-time unlimited purchases.",
      inputSchema: {
        seller: z.string().optional().describe("Filter to one creator by name (e.g. 'Lena Brandt')."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ seller }) => {
      const earnings = await deps.earnings.list();
      const scoped = earnings.filter((e) => !seller || e.seller === seller);
      if (scoped.length === 0) return textResult("No earnings recorded yet.");

      const currency = scoped[0]!.currency;
      const micro = scoped.filter((e) => e.mode === "micro");
      const flat = scoped.filter((e) => e.mode === "flat");
      const sum = (xs: typeof scoped) => Math.round(xs.reduce((s, e) => s + e.amount, 0) * 100) / 100;
      const total = sum(scoped);

      const lines = [
        `**${euro(total, currency)} earned**, paid out in euros — ${scoped.length} payment(s).`,
        micro.length
          ? `• Micro: ${euro(sum(micro), currency)} from ${micro.length} per-question micropayment(s).`
          : null,
        flat.length ? `• Flat: ${euro(sum(flat), currency)} from ${flat.length} unlimited purchase(s).` : null,
      ].filter(Boolean);
      return textResult(lines.join("\n"));
    },
  );
}
