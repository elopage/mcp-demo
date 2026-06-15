import type { Earning } from "../types.js";

export interface EarningsTotal {
  amount: number;
  currency: string;
  count: number;
}

/**
 * Where creator earnings are recorded. This is the EMITTER half of the cross-repo
 * bridge: the MCP writes earnings to a stable local contract; a later, separate
 * elopage change reads it into the ablefy-light console ledger (never cross-committed).
 */
export interface EarningsSink {
  record(e: Earning): Promise<void>;
  list(): Promise<Earning[]>;
  total(seller?: string): Promise<EarningsTotal>;
}
