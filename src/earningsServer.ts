import http from "node:http";
import type { Config } from "./config.js";
import { FileEarningsSink } from "./earnings/fileSink.js";

/**
 * Tiny read-only localhost HTTP endpoint that serves the earnings ledger — the
 * transport half of the cross-repo bridge. The ablefy-light console (elopage,
 * Act 1) fetches this on mount and replays each earning through its money spine.
 * The console can't read local files; this is how the file reaches it.
 *
 *   GET /earnings → { version, currency, total: {amount,currency,count}, earnings: Earning[] }
 *
 * CORS-open because the console is served from a different localhost origin.
 * Started standalone (`npm run earnings:serve`) or alongside the MCP when
 * EARNINGS_SERVE=1 (so one Claude Desktop config powers the whole demo).
 */
export function startEarningsServer(cfg: Config, port: number = cfg.earningsPort): http.Server {
  const sink = new FileEarningsSink(cfg.earningsFile, cfg.currency);

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    const path = (req.url ?? "").split("?")[0];

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET" && path === "/earnings") {
      Promise.all([sink.list(), sink.total()])
        .then(([earnings, total]) => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ version: 1, currency: cfg.currency, total, earnings }));
        })
        .catch((e) => {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: String(e) }));
        });
      return;
    }
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, endpoint: "/earnings" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, "127.0.0.1", () => {
    console.error(`[ablefy-mcp] earnings endpoint → http://127.0.0.1:${port}/earnings`);
  });
  return server;
}
