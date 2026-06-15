// Verify the buyer-chosen cap (offline: fake coach + mock rail). Trial → authorize
// with a €0.25 cap → one ask fits → next ask is refused at the cap. Run: npm run cap:check
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ablefy-cap-"));
let failures = 0;
const check = (l, c, d = "") => {
  console.log(`${c ? "PASS" : "FAIL"} · ${l}${c || !d ? "" : `\n   ↳ ${d}`}`);
  if (!c) failures++;
};

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  env: { ...process.env, PRICE_PER_Q: "0.10", MONTHLY_CAP: "9.00", EARNINGS_FILE: path.join(tmp, "e.json"), METER_FILE: path.join(tmp, "m.json") },
});
const client = new Client({ name: "cap", version: "1.0.0" });
await client.connect(transport);
const PID = "svc_lena_systems_coach";
const call = async (n, a = {}) => (await client.callTool({ name: n, arguments: a })).content.map((c) => c.text).join("\n");

try {
  const t = await call("ablefy_ask_coach", { product_id: PID, question: "trial" }); // €0.10
  check("trial charged", /Paid €0\.10/.test(t), t);
  const auth = await call("ablefy_authorize_allowance", { product_id: PID, monthly_cap: 0.25 });
  check("authorized at the buyer's €0.25 cap", /capped at \*\*€0\.25/.test(auth), auth);
  const q2 = await call("ablefy_ask_coach", { product_id: PID, question: "within cap" }); // spent 0.20
  check("ask within cap charges (€0.05 left)", /Paid €0\.10/.test(q2) && /€0\.05 left/.test(q2), q2);
  const q3 = await call("ablefy_ask_coach", { product_id: PID, question: "over cap" }); // 0.30 > 0.25
  check("ask beyond the €0.25 cap is refused", /cap of €0\.25 reached/.test(q3) && !/Paid €/.test(q3), q3);
} finally {
  await client.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${failures === 0 ? "✓ buyer-chosen cap verified" : `✗ ${failures} failed`}`);
process.exit(failures === 0 ? 0 : 1);
