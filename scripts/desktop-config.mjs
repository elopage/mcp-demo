// Merge the ablefy MCP server into the Claude Desktop config, pulling values from
// .env (Claude Desktop doesn't read .env — it needs them inline in its config).
// Run: npm run desktop:config   (after filling .env). Preserves any other servers.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cfgPath = path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
const serverEntry = path.resolve("dist/index.js");

const KEYS = [
  "ABLEFY_BACKEND", "ABLEFY_API_BASE", "COACH_PRODUCT_SLUG", "PRICE_PER_Q", "MONTHLY_CAP",
  "PAYMENT_RAIL", "ALGOD_URL", "BUYER_WALLET_MNEMONIC", "CREATOR_ADDRESS", "ALGO_MICROALGOS_PER_Q",
  "COACH_LLM", "LLM_BASE_URL", "LLM_API_KEY", "COACH_MODEL", "EARNINGS_SERVE", "EARNINGS_PORT",
  "CONNECTOR_MODE", "CONNECTOR_NAME", "WEB_SERVE", "WEB_PORT",
];
const env = {};
for (const k of KEYS) if (process.env[k]) env[k] = process.env[k];

let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
} catch {
  /* no config yet → start fresh */
}
cfg.mcpServers = cfg.mcpServers || {};
// Absolute node path — the GUI app's PATH often lacks nvm/homebrew node ("spawn node ENOENT").
cfg.mcpServers.ablefy = { command: process.execPath, args: [serverEntry], env };

fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

// masked echo — never print secrets
const masked = { ...env };
for (const k of ["BUYER_WALLET_MNEMONIC", "LLM_API_KEY"]) if (masked[k]) masked[k] = masked[k].slice(0, 4) + "…(set)";
console.log("✓ wrote ablefy server →", cfgPath);
console.log("  command:", process.execPath, serverEntry);
console.log("  env:", JSON.stringify(masked));
console.log("\nNow: fully quit & reopen Claude Desktop, then the ablefy_* tools appear in a new chat.");
