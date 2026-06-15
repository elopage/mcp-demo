import algosdk from "algosdk";
import type { PaymentReceipt } from "../types.js";
import type { PaymentRail } from "./rail.js";
import type { Config } from "../config.js";

/**
 * Real on-chain micropayment rail — Algorand testnet, native ALGO (slice 3, the
 * hero). The buyer wallet lives server-side (brief §3); each `charge` builds,
 * signs, and submits a payment from buyer → creator and waits for confirmation,
 * returning a real, explorer-provable tx id.
 *
 * The euro amount (€0.10) is what the meter/earnings track; the on-chain transfer
 * is a small fixed ALGO amount (testnet value is symbolic — the point is a real,
 * verifiable tx). Diverges from the brief's x402/Base by design (see README/STATUS):
 * the server-side wallet means x402's HTTP handshake is never exercised anyway.
 */
export class AlgorandRail implements PaymentRail {
  readonly name = "algorand";
  private readonly algod: algosdk.Algodv2;
  private readonly buyer: algosdk.Account;
  private readonly creator: string;
  private readonly microAlgosPerQ: number;
  private readonly explorerBase: string;

  constructor(cfg: Config) {
    if (!cfg.buyerMnemonic) throw new Error("BUYER_WALLET_MNEMONIC is required for PAYMENT_RAIL=algorand");
    if (!cfg.creatorAddress) throw new Error("CREATOR_ADDRESS is required for PAYMENT_RAIL=algorand");
    this.algod = new algosdk.Algodv2(cfg.algodToken, cfg.algodUrl, "");
    this.buyer = algosdk.mnemonicToSecretKey(cfg.buyerMnemonic);
    this.creator = cfg.creatorAddress;
    this.microAlgosPerQ = cfg.microAlgosPerQ;
    this.explorerBase = cfg.algoExplorerBase;
  }

  /** The buyer wallet address (for logging / funding checks). */
  get buyerAddress(): string {
    return this.buyer.addr.toString();
  }

  async charge(amount: number, currency: string, memo: string): Promise<PaymentReceipt> {
    const suggestedParams = await this.algod.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: this.buyer.addr,
      receiver: this.creator,
      amount: BigInt(this.microAlgosPerQ),
      note: new TextEncoder().encode(memo),
      suggestedParams,
    });
    const signed = txn.signTxn(this.buyer.sk);
    const txId = txn.txID();
    await this.algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(this.algod, txId, 4);

    return {
      rail: this.name,
      txId,
      explorerUrl: `${this.explorerBase}${txId}`,
      amount, // euro-denominated — what the meter/earnings track
      currency,
      asset: "ALGO",
      assetAmount: this.microAlgosPerQ / 1_000_000,
      assetUnit: "ALGO",
      timestamp: new Date().toISOString(),
    };
  }
}
