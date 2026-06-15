import type { Coach } from "../types.js";
import type { AblefyBackend } from "./backend.js";
import type { Config } from "../config.js";

/**
 * In-memory stand-in for the ablefy backend (slice 1). Seeds the Act-1 persona —
 * Lena Brandt / The Systems Studio — and her `service` coaching product, so the
 * cross-repo demo reads as one business. Flat access is held in a Set; slice 2
 * replaces this with a real seeded Rails BE behind the same `AblefyBackend` shape.
 */
export class FakeAblefyBackend implements AblefyBackend {
  private readonly coach: Coach;
  /** `${productId}:${buyerEmail}` → MembershipSession id. */
  private readonly flatGrants = new Map<string, string>();

  constructor(cfg: Config) {
    this.coach = {
      productId: "svc_lena_systems_coach",
      slug: cfg.coachSlug,
      name: "Lena AI — Systems Coach",
      creator: "Lena Brandt",
      studio: "The Systems Studio",
      description:
        "An AI coach trained on Lena Brandt's second-brain method — capture, " +
        "weekly review, and a Notion/Obsidian system that actually sticks. " +
        "Ask anything about building a personal knowledge system.",
      pricePerQuestion: cfg.pricePerQ,
      monthlyCap: cfg.monthlyCap,
      flatPrice: cfg.monthlyCap, // cap == flat price by design (€0.10 × 90 = €9)
      currency: cfg.currency,
    };
  }

  async findCoaches({ query, slug }: { query?: string; slug?: string }): Promise<Coach[]> {
    // The fake hosts exactly one coach. Surface it unless a slug filter excludes it.
    if (slug && slug !== this.coach.slug) return [];
    void query; // a real backend would search; the fake always returns Lena.
    return [this.coach];
  }

  async getCoach(productId: string): Promise<Coach | null> {
    return productId === this.coach.productId ? this.coach : null;
  }

  async grantFlatAccess(productId: string, buyerEmail: string): Promise<{ sessionId: string }> {
    const sessionId = `ms_${Math.random().toString(36).slice(2, 10)}`;
    this.flatGrants.set(`${productId}:${buyerEmail}`, sessionId);
    return { sessionId };
  }

  async hasFlatAccess(productId: string, buyerEmail: string): Promise<boolean> {
    return this.flatGrants.has(`${productId}:${buyerEmail}`);
  }
}
