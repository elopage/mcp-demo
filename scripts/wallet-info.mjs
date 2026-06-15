// Print an Algorand testnet account balance. Run: npm run wallet:info
// Uses ADDR=<address> or BUYER_WALLET_MNEMONIC (from .env).
import algosdk from "algosdk";

const algod = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN ?? "",
  process.env.ALGOD_URL ?? "https://testnet-api.algonode.cloud",
  "",
);

let addr = process.env.ADDR;
if (!addr && process.env.BUYER_WALLET_MNEMONIC) {
  addr = algosdk.mnemonicToSecretKey(process.env.BUYER_WALLET_MNEMONIC).addr.toString();
}
if (!addr) {
  console.error("Set ADDR=<address> or BUYER_WALLET_MNEMONIC");
  process.exit(1);
}

const info = await algod.accountInformation(addr).do();
console.log(`${addr}\n  balance: ${Number(info.amount) / 1e6} ALGO`);
