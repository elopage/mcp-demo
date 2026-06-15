// Slice-1 smoke test: drive the built server over stdio via the MCP client and
// assert the whole flow — discover → trial → gate → authorize → cap → flat.
// Uses a low cap (€0.20) and temp state files so every branch is exercised cleanly.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(here, "..", "dist", "index.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ablefy-mcp-smoke-"));

let failures = 0;
function check(label, cond, detail = "") {
  const ok = !!cond;
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${ok || !detail ? "" : `\n      ↳ ${detail}`}`);
  if (!ok) failures++;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  env: {
    ...process.env,
    PRICE_PER_Q: "0.10",
    MONTHLY_CAP: "0.20", // low on purpose so the cap branch is reachable
    EARNINGS_FILE: path.join(tmp, "earnings.json"),
    METER_FILE: path.join(tmp, "meter.json"),
  },
});

const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);

const PID = "svc_lena_systems_coach";
async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args });
  return (res.content ?? []).map((c) => c.text ?? "").join("\n");
}

try {
  // 1. tools/list
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  check("6 tools registered", tools.length === 6, names.join(", "));
  check(
    "expected tool names",
    ["ablefy_ask_coach", "ablefy_authorize_allowance", "ablefy_creator_earnings", "ablefy_find_coach", "ablefy_get_offer", "ablefy_pay_flat"].every(
      (n) => names.includes(n),
    ),
    names.join(", "),
  );

  // 2. discover
  const find = await call("ablefy_find_coach", { query: "second brain note system" });
  check("find_coach surfaces Lena", /Lena AI — Systems Coach/.test(find) && find.includes(PID), find);

  // 3. offer
  const offer = await call("ablefy_get_offer", { product_id: PID });
  check("get_offer shows both modes", /Micropayment/.test(offer) && /Flat/.test(offer), offer);

  // 4. trial ask (no allowance yet) → charges once, flagged as trial
  const trial = await call("ablefy_ask_coach", { product_id: PID, question: "How do I capture notes on mobile?" });
  check("trial charges €0.10 + answers", /Paid €0\.10/.test(trial) && /tx/.test(trial) && /trial/.test(trial), trial);

  // 5. second ask without allowance → gated, no charge
  const gated = await call("ablefy_ask_coach", { product_id: PID, question: "And weekly review?" });
  check("second ask gated (no charge)", /trial question/.test(gated) && !/Paid €/.test(gated), gated);

  // 6. authorize the allowance
  const auth = await call("ablefy_authorize_allowance", { product_id: PID });
  check("allowance authorized", /Allowance authorized/.test(auth), auth);

  // 7. ask within allowance → charges, remaining hits €0.00 (cap 0.20, trial used 0.10)
  const a2 = await call("ablefy_ask_coach", { product_id: PID, question: "Notion or Obsidian?" });
  check("authorized ask charges", /Paid €0\.10/.test(a2) && /€0\.00 left/.test(a2), a2);

  // 8. next ask exceeds cap → refused, no charge
  const capped = await call("ablefy_ask_coach", { product_id: PID, question: "One more?" });
  check("cap enforced", /cap of €0\.20 reached/.test(capped) && !/Paid €/.test(capped), capped);

  // 9. earnings: 2 micro charges = €0.20
  const earn = await call("ablefy_creator_earnings", { seller: "Lena Brandt" });
  check("earnings total €0.20 / 2 payments", /€0\.20 earned/.test(earn) && /2 payment/.test(earn), earn);

  // 10. flat purchase for a distinct buyer
  const flat = await call("ablefy_pay_flat", { product_id: PID, buyer_email: "buyer@example.com" });
  check("flat access granted", /Flat access granted/.test(flat) && /MembershipSession/.test(flat), flat);

  // 11. flat buyer asks → free + unlimited even though the meter cap is maxed
  const flatAsk = await call("ablefy_ask_coach", {
    product_id: PID,
    question: "Anything else?",
    buyer_email: "buyer@example.com",
  });
  check("flat ask is free + unlimited", /flat · unlimited/.test(flatAsk) && !/Paid €/.test(flatAsk), flatAsk);
} finally {
  await client.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${failures === 0 ? "✓ all checks passed" : `✗ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
