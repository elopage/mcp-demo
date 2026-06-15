import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

// Repo-local rails-runner scripts (seed/) the MCP shells into the local BE.
// dist/ablefy/httpBackend.js and src/ablefy/httpBackend.ts are both two levels deep.
const SEED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../seed");

/**
 * Real backend against the local ablefy Rails app. Discover is a public storefront
 * call — `GET /v1/shop/{slug}/products?form=<coachForm>`, no auth.
 *
 * Flat mode is the **real access-grant spine**: a comped €9 order →
 * `Sellable#process_membership_session!` → a real `MembershipSession` row in ablefy's
 * Postgres (proof: `SELECT … FROM membership_sessions`). The MCP drives this by shelling
 * a repo-local Ruby script into the running container (`docker exec … bin/rails runner -`),
 * exactly like the seed — demo code never lands in the backend. The coach must therefore
 * be a **membership** product (only memberships create a MembershipSession).
 *
 * The membership_session id is cached write-through to a local file so the hot path
 * (`ask_coach` → `hasFlatAccess`) stays instant and survives a Desktop restart; the grant
 * itself is idempotent (a buyer who already holds access is not re-granted).
 */
export class HttpAblefyBackend implements AblefyBackend {
  private readonly creator = "Lena Brandt";
  private readonly studio = "The Systems Studio";

  constructor(private readonly cfg: Config) {}

  private async fetchCoachProducts(slug: string): Promise<ShopProduct[]> {
    const url = `${this.cfg.ablefyApiBase}/v1/shop/${encodeURIComponent(slug)}/products?form=${encodeURIComponent(this.cfg.coachForm)}`;
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
      description: (p.description || p.short_description || "").replace(/<[^>]*>/g, "").trim(),
      pricePerQuestion: this.cfg.pricePerQ, // MCP-owned meter
      monthlyCap: this.cfg.monthlyCap, // MCP-owned cap
      flatPrice, // the ablefy product's price
      currency: this.cfg.currency,
    };
  }

  async findCoaches({ query, slug }: { query?: string; slug?: string }): Promise<Coach[]> {
    void query; // the storefront API doesn't free-text search; the demo shop hosts one coach
    const products = await this.fetchCoachProducts(slug ?? this.cfg.coachSlug);
    return products.map((p) => this.toCoach(p));
  }

  async getCoach(productId: string): Promise<Coach | null> {
    const products = await this.fetchCoachProducts(this.cfg.coachSlug);
    const match = products.find((p) => String(p.id) === String(productId));
    return match ? this.toCoach(match) : null;
  }

  async grantFlatAccess(productId: string, buyerEmail: string): Promise<{ sessionId: string }> {
    const out = await this.railsRunner("grant_flat.rb", {
      GRANT_PRODUCT_ID: String(productId),
      GRANT_BUYER_EMAIL: buyerEmail,
    });
    const ok = out.match(/MEMBERSHIP_SESSION_ID=(\S+)/);
    if (!ok) {
      const err = out.match(/GRANT_ERROR=([^\n]+)/);
      throw new Error(`flat grant failed on the local ablefy backend: ${err ? err[1].trim() : out.slice(-200).trim()}`);
    }
    const sessionId = ok[1];
    this.cacheGrant(productId, buyerEmail, sessionId);
    return { sessionId };
  }

  async hasFlatAccess(productId: string, buyerEmail: string): Promise<boolean> {
    // Hot path: read the write-through cache (instant, survives restarts). The cache is
    // populated only by a real grant that returned a MembershipSession id, so a hit means
    // a real row exists. `rm flat-access.json` (npm run reset) clears it; a re-purchase
    // reconciles via the idempotent grant.
    return this.readCache()[this.cacheKey(productId, buyerEmail)] != null;
  }

  // --- rails-runner bridge (run-local dependency; never a commit target) ---

  private railsRunner(script: string, env: Record<string, string>, timeoutMs = 60_000): Promise<string> {
    const scriptPath = path.join(SEED_DIR, script);
    let body: string;
    try {
      body = fs.readFileSync(scriptPath, "utf8");
    } catch (e) {
      return Promise.reject(new Error(`cannot read ${scriptPath}: ${(e as Error).message}`));
    }
    return new Promise((resolve, reject) => {
      const args = ["exec", "-i"];
      for (const [k, v] of Object.entries(env)) args.push("-e", `${k}=${v}`);
      args.push(this.cfg.railsContainer, "bin/rails", "runner", "-");
      const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`rails runner timed out after ${timeoutMs}ms (is "${this.cfg.railsContainer}" up?)`));
      }, timeoutMs);
      child.stdout.on("data", (d) => (out += d.toString()));
      child.stderr.on("data", (d) => (out += d.toString())); // scripts print KEY=value to stdout; logs are silenced
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`docker exec failed (${(e as Error).message}) — is docker running?`));
      });
      child.on("close", () => {
        clearTimeout(timer);
        resolve(out);
      });
      child.stdin.write(body);
      child.stdin.end();
    });
  }

  // --- write-through flat-access cache ---

  private cacheKey(productId: string, buyerEmail: string): string {
    return `${productId}:${buyerEmail.trim().toLowerCase()}`;
  }

  private readCache(): Record<string, { sessionId: string; grantedAt: string }> {
    try {
      return JSON.parse(fs.readFileSync(this.cfg.flatAccessFile, "utf8"));
    } catch {
      return {};
    }
  }

  private cacheGrant(productId: string, buyerEmail: string, sessionId: string): void {
    const cache = this.readCache();
    cache[this.cacheKey(productId, buyerEmail)] = { sessionId, grantedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(this.cfg.flatAccessFile), { recursive: true });
    fs.writeFileSync(this.cfg.flatAccessFile, JSON.stringify(cache, null, 2));
  }
}
