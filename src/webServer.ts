import http from "node:http";
import type { Deps } from "./deps.js";
import type { Coach } from "./types.js";
import type { Config } from "./config.js";
import { euro } from "./format.js";

/**
 * Tiny buyer-facing landing page served alongside the MCP (WEB_SERVE=1, port 7655).
 * Target of foroom's "Ask Lena" publish link (Brief A, Slice 4).
 *
 *   GET /          → HTML page: offer + both prices + "Add to Claude" section
 *   GET /offer.json → JSON: current coach + pricing (live from backend)
 *   GET /health    → { ok: true }
 *
 * Prices come from the backend at request-time so they can't drift from the real offer.
 */
export function startWebServer(deps: Deps, port: number = deps.config.webPort): http.Server {
  const { config, backend } = deps;

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const urlPath = (req.url ?? "").split("?")[0];

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && urlPath === "/") {
      backend
        .findCoaches({})
        .then((coaches) => {
          const coach = coaches[0];
          if (!coach) {
            res.writeHead(503, { "content-type": "text/html; charset=utf-8" });
            res.end(errorPage("No coach found — is the ablefy backend running?"));
            return;
          }
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(renderPage(coach, config));
        })
        .catch((e: Error) => {
          res.writeHead(503, { "content-type": "text/html; charset=utf-8" });
          res.end(errorPage(`Backend error: ${e.message}`));
        });
      return;
    }

    if (req.method === "GET" && urlPath === "/offer.json") {
      backend
        .findCoaches({})
        .then((coaches) => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ coach: coaches[0] ?? null, connectorName: config.connectorName }));
        })
        .catch((e: Error) => {
          res.writeHead(503, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        });
      return;
    }

    if (req.method === "GET" && (urlPath === "/health" || urlPath === "/")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on("error", (err) => {
    console.error(
      `[ablefy-mcp] buyer page disabled (${(err as Error).message}) — MCP continues`,
    );
  });
  server.listen(port, "127.0.0.1", () => {
    console.error(`[ablefy-mcp] buyer page → http://127.0.0.1:${port}/`);
  });
  return server;
}

function renderPage(coach: Coach, cfg: Config): string {
  const perQ = euro(coach.pricePerQuestion, coach.currency);
  const cap = euro(coach.monthlyCap, coach.currency);
  const flat = euro(coach.flatPrice, coach.currency);
  const connectorName = cfg.connectorName;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(connectorName)} — ${escHtml(coach.studio)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --green: #00d27f;
      --green-light: #e6fff4;
      --bg: #f9fafb;
      --surface: #fff;
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --radius: 12px;
      --mono: "SF Mono", "Fira Code", Menlo, monospace;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      max-width: 520px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: var(--green);
      padding: 1.5rem 2rem;
      color: #fff;
    }
    .header .studio { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; opacity: 0.85; text-transform: uppercase; margin-bottom: 0.4rem; }
    .header h1 { font-size: 1.5rem; font-weight: 700; line-height: 1.2; }
    .header .by { font-size: 0.875rem; opacity: 0.85; margin-top: 0.25rem; }
    .body { padding: 1.75rem 2rem; }
    .description { color: var(--muted); font-size: 0.9375rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .section-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.75rem; }
    .pricing { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.75rem; }
    .plan {
      border: 1.5px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
    }
    .plan.featured {
      border-color: var(--green);
      background: var(--green-light);
    }
    .plan .price { font-size: 1.25rem; font-weight: 700; color: var(--text); }
    .plan .label { font-size: 0.8125rem; color: var(--muted); margin-top: 0.2rem; line-height: 1.4; }
    .plan.featured .label { color: #065f46; }
    .divider { border: none; border-top: 1px solid var(--border); margin: 0 0 1.75rem; }
    .add-section { }
    .add-section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .add-section p { font-size: 0.875rem; color: var(--muted); margin-bottom: 1rem; line-height: 1.5; }
    .code-block {
      background: #f3f4f6;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      font-family: var(--mono);
      font-size: 0.8125rem;
      color: #1f2937;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .copy-btn {
      background: none;
      border: 1px solid var(--border);
      border-radius: 5px;
      padding: 0.2rem 0.5rem;
      font-size: 0.75rem;
      cursor: pointer;
      color: var(--muted);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .copy-btn:hover { background: var(--border); color: var(--text); }
    .note { font-size: 0.8125rem; color: var(--muted); line-height: 1.5; }
    .note code { font-family: var(--mono); background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
    .footer { padding: 1rem 2rem; border-top: 1px solid var(--border); background: #f9fafb; font-size: 0.8125rem; color: var(--muted); display: flex; align-items: center; gap: 0.5rem; }
    .footer a { color: var(--green); text-decoration: none; font-weight: 600; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="studio">${escHtml(coach.studio)}</div>
      <h1>${escHtml(connectorName)}</h1>
      <div class="by">by ${escHtml(coach.creator)} · ${escHtml(coach.name)}</div>
    </div>
    <div class="body">
      <p class="description">${escHtml(coach.description)}</p>

      <div class="section-label">Pricing</div>
      <div class="pricing">
        <div class="plan featured">
          <div class="price">${escHtml(perQ)}<span style="font-size:0.75rem;font-weight:400">/question</span></div>
          <div class="label">Pay per question, capped at ${escHtml(cap)}/month</div>
        </div>
        <div class="plan">
          <div class="price">${escHtml(flat)}</div>
          <div class="label">Flat — unlimited access, no cap</div>
        </div>
      </div>

      <hr class="divider" />

      <div class="add-section">
        <h2>Add to Claude</h2>
        <p>Clone the repo and configure your local Claude Desktop in two commands:</p>
        <div class="code-block">
          <span>git clone https://github.com/elopage/mcp-demo &amp;&amp; cd mcp-demo</span>
          <button class="copy-btn" onclick="copy(this, 'git clone https://github.com/elopage/mcp-demo && cd mcp-demo')">Copy</button>
        </div>
        <div class="code-block">
          <span>npm install &amp;&amp; npm run build &amp;&amp; npm run desktop:config</span>
          <button class="copy-btn" onclick="copy(this, 'npm install && npm run build && npm run desktop:config')">Copy</button>
        </div>
        <p class="note">
          Quit Claude Desktop first, then run <code>npm run desktop:config</code> (requires a filled <code>.env</code>).
          Reopen Desktop — <strong>${escHtml(connectorName)}</strong> appears in your connector list.
        </p>
      </div>
    </div>
    <div class="footer">
      Powered by <a href="https://ablefy.io" target="_blank" rel="noopener">ablefy</a>
      · Payments on Algorand testnet · Answers via ${escHtml(coach.name)}
    </div>
  </div>
  <script>
    function copy(btn, text) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      });
    }
  </script>
</body>
</html>`;
}

function errorPage(msg: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem"><h2>⚠️ ${escHtml(msg)}</h2></body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
