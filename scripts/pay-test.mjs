// Do ONE real micropayment with your configured wallet. Run: npm run pay:test
// Requires .env with PAYMENT_RAIL=algorand, BUYER_WALLET_MNEMONIC (funded),
// CREATOR_ADDRESS. Prints the receipt with the explorer link.
import { loadConfig } from "../dist/config.js";
import { AlgorandRail } from "../dist/payment/algorandRail.js";

const cfg = loadConfig();
if (cfg.paymentRail !== "algorand") {
  console.error("Set PAYMENT_RAIL=algorand in .env");
  process.exit(1);
}

const rail = new AlgorandRail(cfg);
console.log("buyer:  ", rail.buyerAddress);
console.log("creator:", cfg.creatorAddress);

const receipt = await rail.charge(cfg.pricePerQ, cfg.currency, "ablefy-mcp pay:test");
console.log(JSON.stringify(receipt, null, 2));
