import type { Coach } from "../types.js";

/**
 * The slice of ablefy the MCP depends on. Slice 1 fulfils this with an in-memory
 * fake; slice 2 swaps in a real local Rails backend behind the same interface.
 *
 * Only FLAT mode touches ablefy's access-grant spine (comped order →
 * `charge_or_give_access!` → `MembershipSession`). Micro mode is metered entirely
 * inside the MCP and never calls this.
 */
export interface AblefyBackend {
  /** Discover sellable coaches (`GET /v1/shop/{slug}/products?form=service`). */
  findCoaches(opts: { query?: string; slug?: string }): Promise<Coach[]>;
  /** Look up one coach by product id. */
  getCoach(productId: string): Promise<Coach | null>;
  /** Flat mode: comped €9 order → grant access. Returns the session id. */
  grantFlatAccess(productId: string, buyerEmail: string): Promise<{ sessionId: string }>;
  /** Does this buyer already hold an unlimited (flat) MembershipSession? */
  hasFlatAccess(productId: string, buyerEmail: string): Promise<boolean>;
}
