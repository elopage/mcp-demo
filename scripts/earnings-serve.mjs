// Serve the earnings ledger for the ablefy-light console bridge.
// Run: npm run earnings:serve   (standalone; or set EARNINGS_SERVE=1 on the MCP itself)
import { loadConfig } from "../dist/config.js";
import { startEarningsServer } from "../dist/earningsServer.js";

const cfg = loadConfig();
startEarningsServer(cfg, Number(process.env.EARNINGS_PORT ?? cfg.earningsPort));
console.error(`serving ${cfg.earningsFile} — Ctrl-C to stop`);
