import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

interface Allowance {
  authorized: boolean;
  allowanceId?: string;
  pricePerQ: number;
  monthlyCap: number;
  month: string; // "YYYY-MM" the spend window belongs to
  spentThisMonth: number;
  charges: { amount: number; txId: string; at: string; question?: string }[];
}

type MeterState = Record<string, Allowance>;

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * The bounded-allowance meter — net-new core (brief §6). It owns the per-question
 * price, the monthly cap, and the running spend per coach. Authorizing the
 * allowance is the buyer's single bounded mandate (€0.10/q ≤ €9/mo); the meter
 * refuses charges past the cap. Persisted to a local JSON file so a demo survives
 * a Claude Desktop restart. Spend auto-resets when the calendar month rolls over.
 */
export class Meter {
  private state: MeterState;

  constructor(private readonly file: string) {
    this.state = this.load();
  }

  private load(): MeterState {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8")) as MeterState;
    } catch {
      return {};
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2));
  }

  /** Fetch the allowance, resetting the spend window if the month rolled over. */
  private get(productId: string): Allowance | undefined {
    // Re-read the file on every access so it's the source of truth: a
    // `rm meter.json` resets the live demo with no server restart, and separate
    // processes (Desktop MCP, CLI scripts) stay consistent.
    this.state = this.load();
    const a = this.state[productId];
    if (a && a.month !== currentMonth()) {
      a.month = currentMonth();
      a.spentThisMonth = 0;
      a.charges = [];
      this.save();
    }
    return a;
  }

  isAuthorized(productId: string): boolean {
    return this.get(productId)?.authorized ?? false;
  }

  /** Number of charges already taken this month (0 ⇒ the next ask is the trial). */
  chargesThisMonth(productId: string): number {
    return this.get(productId)?.charges.length ?? 0;
  }

  /** Authorize the bounded allowance for a coach. Returns the allowance id. */
  authorize(productId: string, pricePerQ: number, monthlyCap: number): string {
    const existing = this.get(productId);
    const allowanceId = existing?.allowanceId ?? `allw_${crypto.randomBytes(5).toString("hex")}`;
    this.state[productId] = {
      authorized: true,
      allowanceId,
      pricePerQ,
      monthlyCap,
      month: currentMonth(),
      spentThisMonth: existing?.spentThisMonth ?? 0,
      charges: existing?.charges ?? [],
    };
    this.save();
    return allowanceId;
  }

  /** Euro left under this month's cap. */
  remaining(productId: string, monthlyCap: number): number {
    const spent = this.get(productId)?.spentThisMonth ?? 0;
    return Math.max(0, round2(monthlyCap - spent));
  }

  /** Would a charge of `amount` stay within the cap? */
  canCharge(productId: string, amount: number, monthlyCap: number): boolean {
    return this.remaining(productId, monthlyCap) + 1e-9 >= amount;
  }

  /** Book a settled charge against the month's spend. */
  recordCharge(
    productId: string,
    amount: number,
    txId: string,
    pricePerQ: number,
    monthlyCap: number,
    question?: string,
  ): void {
    const a = this.get(productId) ?? {
      authorized: false,
      pricePerQ,
      monthlyCap,
      month: currentMonth(),
      spentThisMonth: 0,
      charges: [],
    };
    a.spentThisMonth = round2(a.spentThisMonth + amount);
    a.charges.push({ amount, txId, at: new Date().toISOString(), question });
    this.state[productId] = a;
    this.save();
  }

  /**
   * The most recent charge for the same question within `windowMs` — the
   * idempotency hook so a re-asked question isn't charged twice.
   */
  findRecentCharge(productId: string, question: string, windowMs: number): { txId: string; at: string } | undefined {
    const a = this.get(productId);
    if (!a) return undefined;
    const norm = question.trim().toLowerCase();
    const now = Date.now();
    for (let i = a.charges.length - 1; i >= 0; i--) {
      const c = a.charges[i];
      if (c.question && c.question.trim().toLowerCase() === norm && now - Date.parse(c.at) <= windowMs) {
        return { txId: c.txId, at: c.at };
      }
    }
    return undefined;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
