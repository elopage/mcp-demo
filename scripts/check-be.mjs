// Slice-2 check: drive the built server with the REAL HTTP backend against the
// running local ablefy BE. Verifies discover returns the seeded product; the rail
// (mock) and coach (canned) are still slice-3/4 stubs. Requires the BE up + seeded.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(here, "..", "dist", "index.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ablefy-mcp-be-"));

let failures = 0;
function check(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} · ${label}${cond || !detail ? "" : `\n      ↳ ${detail}`}`);
  if (!cond) failures++;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  env: {
    ...process.env,
    ABLEFY_BACKEND: "http",
    ABLEFY_API_BASE: process.env.ABLEFY_API_BASE ?? "http://localhost:3000",
    COACH_PRODUCT_SLUG: "the-systems-studio",
    PRICE_PER_Q: "0.10",
    MONTHLY_CAP: "9.00",
    EARNINGS_FILE: path.join(tmp, "earnings.json"),
    METER_FILE: path.join(tmp, "meter.json"),
  },
});

const client = new Client({ name: "be-check", version: "1.0.0" });
await client.connect(transport);
async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args });
  return (res.content ?? []).map((c) => c.text ?? "").join("\n");
}

try {
  const find = await call("ablefy_find_coach", { query: "second brain" });
  check("find_coach returns the seeded coach (live BE)", /Lena AI — Systems Coach/.test(find), find);
  const m = find.match(/product_id`?:?\s*(\d+)/i) || find.match(/(\d+)/);
  const pid = m ? m[1] : "1";
  check("find_coach shows €9 flat + €0.10/q", /€9\.00 flat/.test(find) && /€0\.10\/question/.test(find), find);

  const offer = await call("ablefy_get_offer", { product_id: pid });
  check("get_offer (real product) shows both modes", /Micropayment/.test(offer) && /€9\.00/.test(offer), offer);

  const trial = await call("ablefy_ask_coach", { product_id: pid, question: "How do I capture on mobile?" });
  check("ask_coach trial works over real backend", /Paid €0\.10/.test(trial) && /trial/.test(trial), trial);

  const flat = await call("ablefy_pay_flat", { product_id: pid, buyer_email: "buyer@example.com" });
  check("pay_flat grants access", /Flat access granted/.test(flat), flat);

  const flatAsk = await call("ablefy_ask_coach", { product_id: pid, question: "More?", buyer_email: "buyer@example.com" });
  check("flat buyer asks free", /flat · unlimited/.test(flatAsk) && !/Paid €/.test(flatAsk), flatAsk);
} finally {
  await client.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${failures === 0 ? "✓ live-BE checks passed" : `✗ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
