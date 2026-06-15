import type { PaymentReceipt } from "../types.js";

/**
 * A settlement rail for the per-question micropayment. The buyer wallet lives
 * server-side (see brief §3), so the MCP charges on the buyer's behalf and returns
 * a provable receipt. Slice 1 = MockRail; slice 3 = a real Algorand testnet rail
 * behind this same interface (the brief's x402/Base path stays possible too).
 */
export interface PaymentRail {
  /** Human-readable rail name, surfaced in receipts. */
  readonly name: string;
  /**
   * Charge a single micropayment. `amount` is euro-denominated; the rail decides
   * the settlement asset. Throws if the payment cannot be made.
   */
  charge(amount: number, currency: string, memo: string): Promise<PaymentReceipt>;
}
