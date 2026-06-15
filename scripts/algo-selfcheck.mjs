// Verify the Algorand rail end-to-end. Run: npm run algo:check
//
// Always: testnet connectivity + offline txn build/sign (no funds needed).
// If a funded wallet is available (BUYER_WALLET_MNEMONIC in .env, or the testnet
// dispenser funds a freshly generated one), it then does a REAL on-chain charge
// through the actual AlgorandRail class and prints the tx + explorer link.
import algosdk from "algosdk";
import { loadConfig } from "../dist/config.js";
import { AlgorandRail } from "../dist/payment/algorandRail.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const algodUrl = process.env.ALGOD_URL ?? "https://testnet-api.algonode.cloud";
const algod = new algosdk.Algodv2(process.env.ALGOD_TOKEN ?? "", algodUrl, "");

async function tryDispenser(addr) {
  const attempts = [
    "https://bank.testnet.algorand.network/dispense",
    "https://dispenser.testnet.aws.algodev.network/dispense",
  ];
  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `account=${addr}`,
      });
      console.log(`  dispenser ${url} → ${res.status}`);
      if (res.ok) return true;
    } catch (e) {
      console.log(`  dispenser ${url} → ${String(e?.message ?? e)}`);
    }
  }
  return false;
}

// 1. connectivity
const sp = await algod.getTransactionParams().do();
console.log(`PASS · testnet connectivity (round ${sp.firstValid ?? sp.firstRound})`);

// 2. accounts (reuse env buyer if present, else generate)
let buyerMnemonic = process.env.BUYER_WALLET_MNEMONIC;
const buyer = buyerMnemonic ? algosdk.mnemonicToSecretKey(buyerMnemonic) : algosdk.generateAccount();
if (!buyerMnemonic) buyerMnemonic = algosdk.secretKeyToMnemonic(buyer.sk);
const creatorAddress = process.env.CREATOR_ADDRESS || algosdk.generateAccount().addr.toString();
const buyerAddr = buyer.addr.toString();
console.log(`  buyer   ${buyerAddr}`);
console.log(`  creator ${creatorAddress}`);

// 3. offline build + sign
const probe = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
  sender: buyer.addr,
  receiver: creatorAddress,
  amount: 1000n,
  note: new TextEncoder().encode("ablefy-mcp selfcheck"),
  suggestedParams: sp,
});
const signed = probe.signTxn(buyer.sk);
console.log(`PASS · offline build+sign (txID ${probe.txID()}, ${signed.length} bytes)`);

// 4. balance, with a dispenser attempt if empty
let bal = Number((await algod.accountInformation(buyerAddr).do()).amount);
if (bal === 0) {
  console.log("  buyer unfunded — trying the testnet dispenser…");
  await tryDispenser(buyerAddr);
  for (let i = 0; i < 8 && bal === 0; i++) {
    await sleep(3000);
    bal = Number((await algod.accountInformation(buyerAddr).do()).amount);
  }
}
console.log(`  buyer balance: ${bal / 1e6} ALGO`);

// 5. real charge through the actual rail
if (bal >= 2000) {
  process.env.PAYMENT_RAIL = "algorand";
  process.env.BUYER_WALLET_MNEMONIC = buyerMnemonic;
  process.env.CREATOR_ADDRESS = creatorAddress;
  process.env.ALGOD_URL = algodUrl;
  const rail = new AlgorandRail(loadConfig());
  const r = await rail.charge(0.1, "EUR", "ablefy-mcp selfcheck charge");
  console.log("PASS · REAL on-chain charge via AlgorandRail");
  console.log(`  tx:    ${r.txId}`);
  console.log(`  link:  ${r.explorerUrl}`);
  console.log(`  moved: ${r.assetAmount} ${r.assetUnit}  (recorded €${r.amount})`);
  console.log("\n✓ Algorand rail verified end-to-end (real testnet tx).");
} else {
  console.log(
    "\nPARTIAL ✓ code paths verified (connectivity + build + sign). The dispenser\n" +
      "didn't fund automatically. Fund the buyer address above, then re-run\n" +
      "`npm run algo:check`, or set BUYER_WALLET_MNEMONIC in .env and run `npm run pay:test`.",
  );
}
