// Shared domain types for the ablefy pay-to-ask-coach MCP.

/** Which way the buyer is paying for access to the coach. */
export type Mode = "micro" | "flat";

/** A creator's AI coach, as surfaced to a buyer in chat. */
export interface Coach {
  productId: string; // ablefy product id
  slug: string; // shop slug, e.g. "the-systems-studio"
  name: string; // "Lena AI — Systems Coach"
  creator: string; // "Lena Brandt"
  studio: string; // "The Systems Studio"
  description: string;
  pricePerQuestion: number; // micro mode, e.g. 0.10
  monthlyCap: number; // micro mode ceiling, e.g. 9.00
  flatPrice: number; // flat mode, e.g. 9.00
  currency: string; // "EUR"
}

/** Proof of a single on-chain (or mock) micropayment. */
export interface PaymentReceipt {
  rail: string; // "mock" | "algorand"
  txId: string; // tx hash / id
  explorerUrl?: string; // block-explorer link when on a real chain
  amount: number; // euro-denominated amount charged
  currency: string; // "EUR"
  asset: string; // settlement asset: "MOCK" | "ALGO" | "USDC"
  timestamp: string; // ISO 8601
}

/** An earning recorded for the creator — the emitter side of the console bridge. */
export interface Earning {
  productId: string;
  seller: string; // "Lena Brandt"
  mode: Mode;
  amount: number; // euro amount earned on this event
  currency: string;
  buyerEmail?: string;
  receipt?: PaymentReceipt; // present for micro (on-chain), absent for flat (comped)
  timestamp: string; // ISO 8601
}
