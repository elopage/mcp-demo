// End-to-end through the REAL tool path — exactly what Claude Desktop runs.
// Uses the live .env (real BE + Algorand + LiteLLM). Records a real earning to
// ~/.ablefy-mcp/earnings.json (which the console bridge then shows).
// Run: npm run demo:e2e
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry], env: { ...process.env } });
const client = new Client({ name: "demo-e2e", version: "1.0.0" });
await client.connect(transport);
const call = async (name, args = {}) => (await client.callTool({ name, arguments: args })).content.map((c) => c.text).join("\n");

console.log(`config: backend=${process.env.ABLEFY_BACKEND} rail=${process.env.PAYMENT_RAIL} coach=${process.env.COACH_LLM} (${process.env.COACH_MODEL})`);

const find = await call("ablefy_find_coach", { query: "I need a real second-brain note system" });
console.log("\n=== ablefy_find_coach ===\n" + find);

const pid = (find.match(/product_id\D*(\d+)/i) || [])[1] || "1";
const ans = await call("ablefy_ask_coach", { product_id: pid, question: "I keep abandoning my note system. How do I make a weekly review stick?" });
console.log("\n=== ablefy_ask_coach (real €0.10 on-chain + real coach) ===\n" + ans);

console.log("\n=== ablefy_creator_earnings ===\n" + (await call("ablefy_creator_earnings", {})));
await client.close();
