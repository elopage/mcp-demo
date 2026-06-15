// Verify the no-double-charge guard (offline: fake coach + mock rail).
// Same question twice → first charges, second is "on the house" (no charge),
// a different question charges again. Run: npm run idempotency:check
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ablefy-idem-"));
let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} · ${label}${cond || !detail ? "" : `\n   ↳ ${detail}`}`);
  if (!cond) failures++;
};

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  env: { ...process.env, PRICE_PER_Q: "0.10", MONTHLY_CAP: "9.00", EARNINGS_FILE: path.join(tmp, "e.json"), METER_FILE: path.join(tmp, "m.json") },
});
const client = new Client({ name: "idem", version: "1.0.0" });
await client.connect(transport);
const PID = "svc_lena_systems_coach";
const call = async (n, a = {}) => (await client.callTool({ name: n, arguments: a })).content.map((c) => c.text).join("\n");

try {
  await call("ablefy_authorize_allowance", { product_id: PID });
  const Q = "How do I structure my weekly review?";
  const a1 = await call("ablefy_ask_coach", { product_id: PID, question: Q });
  check("1st ask charges", /Paid €0\.10/.test(a1), a1);
  const a2 = await call("ablefy_ask_coach", { product_id: PID, question: Q }); // same question
  check("duplicate is on the house (no 2nd charge, visible note)", /on the house/.test(a2) && !/Paid €/.test(a2), a2);
  const a3 = await call("ablefy_ask_coach", { product_id: PID, question: "What about capture on mobile?" });
  check("a different question charges", /Paid €0\.10/.test(a3), a3);
  const earn = await call("ablefy_creator_earnings", {});
  check("exactly 2 charges recorded (not 3)", /2 payment/.test(earn), earn);
} finally {
  await client.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${failures === 0 ? "✓ no-double-charge guard verified" : `✗ ${failures} failed`}`);
process.exit(failures === 0 ? 0 : 1);
