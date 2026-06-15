import crypto from "node:crypto";
import type { PaymentReceipt } from "../types.js";
import type { PaymentRail } from "./rail.js";

/**
 * Mock settlement rail (slice 1). Mints a realistic-looking 64-hex tx id and a
 * placeholder explorer URL, with no real chain. Lets the whole pay → answer flow
 * run in Claude Desktop today; the real Algorand rail replaces it in slice 3 with
 * identical return shape, so nothing downstream changes.
 */
export class MockRail implements PaymentRail {
  readonly name = "mock";

  async charge(amount: number, currency: string, memo: string): Promise<PaymentReceipt> {
    const txId = "0x" + crypto.randomBytes(32).toString("hex");
    void memo; // a real rail would put the memo in the tx note field
    return {
      rail: this.name,
      txId,
      explorerUrl: `https://example.invalid/tx/${txId}`,
      amount,
      currency,
      asset: "MOCK",
      timestamp: new Date().toISOString(),
    };
  }
}
