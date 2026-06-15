import fs from "node:fs";
import path from "node:path";
import type { Earning } from "../types.js";
import type { EarningsSink, EarningsTotal } from "./sink.js";

/**
 * File-backed earnings sink — the stable local contract the elopage ablefy-light
 * console will consume (the cross-repo seam). Shape on disk:
 *
 *   { "version": 1, "currency": "EUR", "earnings": Earning[] }
 *
 * Append-only; totals are derived on read. Documented in the hub BRIEF's seam
 * section so the console side matches this rather than re-deriving it.
 */
export class FileEarningsSink implements EarningsSink {
  constructor(private readonly file: string, private readonly currency: string) {}

  private read(): Earning[] {
    try {
      const doc = JSON.parse(fs.readFileSync(this.file, "utf8")) as { earnings?: Earning[] };
      return doc.earnings ?? [];
    } catch {
      return [];
    }
  }

  private write(earnings: Earning[]): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(
      this.file,
      JSON.stringify({ version: 1, currency: this.currency, earnings }, null, 2),
    );
  }

  async record(e: Earning): Promise<void> {
    const earnings = this.read();
    earnings.push(e);
    this.write(earnings);
  }

  async list(): Promise<Earning[]> {
    return this.read();
  }

  async total(seller?: string): Promise<EarningsTotal> {
    const earnings = this.read().filter((e) => !seller || e.seller === seller);
    const amount = Math.round(earnings.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    return { amount, currency: this.currency, count: earnings.length };
  }
}
