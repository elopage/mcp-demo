import http from "node:http";
import { readFileSync } from "node:fs";
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

    if (req.method === "GET" && urlPath === "/logo.png") {
      try {
        const buf = readFileSync(new URL("../assets/ask-lena-logo.png", import.meta.url));
        res.writeHead(200, { "content-type": "image/png", "cache-control": "max-age=3600" });
        res.end(buf);
      } catch {
        res.writeHead(404);
        res.end();
      }
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
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .header__logo { width: 56px; height: 56px; border-radius: 12px; background: #fff; padding: 6px; flex-shrink: 0; }
    .header__text { min-width: 0; }
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
    [hidden] { display: none !important; }
    .wallet-intro { font-size: 0.875rem; color: var(--muted); line-height: 1.55; margin-bottom: 1rem; }
    .wallet-row { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
    .wallet-input { flex: 1; min-width: 0; border: 1.5px solid var(--border); border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.875rem; font-family: var(--mono); }
    .wallet-input:focus { outline: none; border-color: var(--green); }
    .wallet-btn { background: var(--green); color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .wallet-btn:hover { filter: brightness(0.96); }
    .wallet-consent { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8125rem; color: var(--muted); line-height: 1.45; cursor: pointer; }
    .wallet-consent input { margin-top: 0.15rem; flex-shrink: 0; }
    .wallet-error { color: #c0392b; font-size: 0.8125rem; margin-top: 0.5rem; }
    .wallet-done { display: flex; align-items: center; gap: 0.75rem; background: var(--green-light); border: 1px solid var(--green); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; }
    .wallet-done__check { width: 24px; height: 24px; border-radius: 50%; background: var(--green); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; flex-shrink: 0; }
    .wallet-done__addr { display: block; font-family: var(--mono); font-size: 0.8125rem; color: var(--muted); }
    .wallet-change { margin-left: auto; background: none; border: 1px solid var(--border); border-radius: 6px; padding: 0.3rem 0.7rem; font-size: 0.75rem; cursor: pointer; color: var(--muted); white-space: nowrap; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img class="header__logo" src="/logo.png" alt="" />
      <div class="header__text">
        <div class="studio">${escHtml(coach.studio)}</div>
        <h1>${escHtml(connectorName)}</h1>
        <div class="by">by ${escHtml(coach.creator)} · ${escHtml(coach.name)}</div>
      </div>
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

      <div class="wallet-section" id="walletSection">
        <div class="section-label">Connect your wallet</div>
        <p class="wallet-intro">
          Add the wallet you’ll pay from. <strong>${escHtml(connectorName)} only ever spends what you
          approve</strong> — in chat you authorize a capped allowance per coach first, and nothing is
          charged without your go-ahead.
        </p>
        <div class="wallet-row">
          <input id="walletInput" class="wallet-input" type="text" autocomplete="off" spellcheck="false"
            placeholder="Your Algorand wallet address (e.g. ALGO…WXYZ)" />
          <button class="wallet-btn" onclick="connectWallet()">Connect wallet</button>
        </div>
        <label class="wallet-consent">
          <input type="checkbox" id="walletConsent" />
          <span>I understand funds are only spent with my permission, within the cap I authorize.</span>
        </label>
        <p class="wallet-error" id="walletError" hidden>Enter a wallet address and tick the box to continue.</p>
      </div>

      <div class="wallet-done" id="walletDone" hidden>
        <span class="wallet-done__check">✓</span>
        <div>
          <strong>Wallet connected</strong>
          <span class="wallet-done__addr" id="walletAddr"></span>
        </div>
        <button class="wallet-change" onclick="changeWallet()">Change</button>
      </div>

      <div class="add-section" id="addSection" hidden>
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
    // Concept demo only — the wallet is NOT stored or written to .env anywhere. This stands in for
    // "the buyer connects a wallet" so the chat flow has one to authorize spending against; once
    // connected we reveal the install commands.
    function connectWallet() {
      var input = document.getElementById('walletInput');
      var consent = document.getElementById('walletConsent');
      var err = document.getElementById('walletError');
      var addr = (input.value || '').trim();
      if (!addr || !consent.checked) { err.hidden = false; return; }
      err.hidden = true;
      var short = addr.length > 14 ? addr.slice(0, 6) + '…' + addr.slice(-4) : addr;
      document.getElementById('walletAddr').textContent = short;
      document.getElementById('walletSection').hidden = true;
      document.getElementById('walletDone').hidden = false;
      document.getElementById('addSection').hidden = false;
    }
    function changeWallet() {
      document.getElementById('walletDone').hidden = true;
      document.getElementById('addSection').hidden = true;
      document.getElementById('walletSection').hidden = false;
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
