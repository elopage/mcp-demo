// Generate a fresh Algorand testnet account. Run: npm run wallet:new
// Make two — one BUYER (fund it), one CREATOR (receives) — for the demo.
import algosdk from "algosdk";

const a = algosdk.generateAccount();
const mnemonic = algosdk.secretKeyToMnemonic(a.sk);

console.log("address: ", a.addr.toString());
console.log("mnemonic:", mnemonic);
console.log("");
console.log("Fund this address on TestNet (a few ALGO is plenty):");
console.log("  https://lora.algokit.io/testnet/fund");
console.log("  https://bank.testnet.algorand.network/");
console.log("");
console.log("Then add to .env (buyer = the wallet that pays):");
console.log(`  BUYER_WALLET_MNEMONIC="${mnemonic}"`);
console.log(`  CREATOR_ADDRESS=${a.addr.toString()}   # or a second wallet:new address`);
