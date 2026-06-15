// Verify the earnings bridge endpoint. Run: npm run earnings:check
// Writes a sample earnings file, serves it, fetches /earnings, asserts the shape.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ablefy-earn-"));
const file = path.join(tmp, "earnings.json");
fs.writeFileSync(
  file,
  JSON.stringify({
    version: 1,
    currency: "EUR",
    earnings: [
      { productId: "1", seller: "Lena Brandt", mode: "micro", amount: 0.1, currency: "EUR", timestamp: new Date().toISOString() },
    ],
  }),
);

process.env.EARNINGS_FILE = file; // loadConfig reads this
const { loadConfig } = await import("../dist/config.js");
const { startEarningsServer } = await import("../dist/earningsServer.js");

const port = 7655;
const server = startEarningsServer(loadConfig(), port);
await new Promise((r) => setTimeout(r, 300));

let ok = false;
let body = "";
try {
  const res = await fetch(`http://127.0.0.1:${port}/earnings`);
  const json = await res.json();
  body = JSON.stringify(json);
  ok =
    res.ok &&
    Array.isArray(json.earnings) &&
    json.earnings.length === 1 &&
    Math.abs(json.total.amount - 0.1) < 1e-9 &&
    json.currency === "EUR";
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(body);
console.log(ok ? "PASS · earnings endpoint serves the ledger" : "FAIL");
process.exit(ok ? 0 : 1);
