import type { Coach } from "../types.js";
import type { AblefyBackend } from "./backend.js";
import type { Config } from "../config.js";

/** Subset of the shop products API response we use. */
interface ShopProduct {
  id: number;
  slug: string;
  name: string;
  form: string;
  description?: string | null;
  short_description?: string | null;
  display_price?: string | null;
  free?: boolean;
}

interface ShopResponse {
  success: boolean;
  data?: { total_count?: number; list?: ShopProduct[] };
}

/**
 * Real backend against the local ablefy Rails app (slice 2). Discover is a public
 * storefront call — `GET /v1/shop/{slug}/products?form=service`, no auth. The
 * ablefy product carries the FLAT price (`display_price`); the per-question price
 * and monthly cap are MCP-owned (config), so they're layered on here.
 *
 * Flat-mode access is held in-memory for now (same as the fake). Wiring the real
 * order → charge_or_give_access! → MembershipSession spine is the tracked slice-2b
 * follow-up; flat is the simulated fallback, not the demo's hero (micro is).
 */
export class HttpAblefyBackend implements AblefyBackend {
  private readonly creator = "Lena Brandt";
  private readonly studio = "The Systems Studio";
  private readonly flatGrants = new Map<string, string>();

  constructor(private readonly cfg: Config) {}

  private async fetchServiceProducts(slug: string): Promise<ShopProduct[]> {
    const url = `${this.cfg.ablefyApiBase}/v1/shop/${encodeURIComponent(slug)}/products?form=service`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ablefy shop API ${res.status} for slug "${slug}"`);
    const json = (await res.json()) as ShopResponse;
    if (!json.success) throw new Error(`ablefy shop API returned success=false for slug "${slug}"`);
    return json.data?.list ?? [];
  }

  private toCoach(p: ShopProduct): Coach {
    const flatPrice = p.display_price != null ? Number(p.display_price) : this.cfg.monthlyCap;
    return {
      productId: String(p.id),
      slug: this.cfg.coachSlug,
      name: p.name,
      creator: this.creator,
      studio: this.studio,
      description: p.description || p.short_description || "",
      pricePerQuestion: this.cfg.pricePerQ, // MCP-owned meter
      monthlyCap: this.cfg.monthlyCap, // MCP-owned cap
      flatPrice, // the ablefy product's price
      currency: this.cfg.currency,
    };
  }

  async findCoaches({ query, slug }: { query?: string; slug?: string }): Promise<Coach[]> {
    void query; // the storefront API doesn't free-text search; the demo shop hosts one coach
    const products = await this.fetchServiceProducts(slug ?? this.cfg.coachSlug);
    return products.map((p) => this.toCoach(p));
  }

  async getCoach(productId: string): Promise<Coach | null> {
    const products = await this.fetchServiceProducts(this.cfg.coachSlug);
    const match = products.find((p) => String(p.id) === String(productId));
    return match ? this.toCoach(match) : null;
  }

  async grantFlatAccess(productId: string, buyerEmail: string): Promise<{ sessionId: string }> {
    // TODO(slice 2b): drive the real comped order → charge_or_give_access! → MembershipSession.
    const sessionId = `ms_local_${Math.random().toString(36).slice(2, 10)}`;
    this.flatGrants.set(`${productId}:${buyerEmail}`, sessionId);
    return { sessionId };
  }

  async hasFlatAccess(productId: string, buyerEmail: string): Promise<boolean> {
    return this.flatGrants.has(`${productId}:${buyerEmail}`);
  }
}
