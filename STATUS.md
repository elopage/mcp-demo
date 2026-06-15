# mcp-demo — STATUS

> Live-state doc for the ablefy "pay-to-ask AI coach" agent-commerce demo (Jira MAC-1871).
> Read at the start of every session, update at the end. Lives on `master`.

## Shipped — built, hardened, and VALIDATED LIVE in Claude Desktop
Branch `1871_mac_mcp_server` (PR → master: https://github.com/elopage/mcp-demo/pull/1).
The full arc ran end-to-end in a real Desktop chat: discover → trial €0.10 → buyer-capped
allowance → flat → coach answer → (bridge) earnings in the console.

- **MCP server + 6 tools** behind interfaces (`AblefyBackend`/`PaymentRail`/`CoachLLM`/`EarningsSink`),
  fake↔real by config. 12/12 offline smoke.
- **Real discover** vs the local ablefy BE (`GET /v1/shop/{slug}/products?form=service`, **public, no token**).
  Repo-local rails-runner seed: Lena Brandt / `the-systems-studio` + `service` product + €9 `one_time` plan + API key.
- **Real Algorand testnet micropayment** (native ALGO) — explorer-provable; MCP owns the meter + cap.
- **Real coach** — Anthropic SDK *and* a LiteLLM/OpenAI-compatible adapter; live via `litellm.ablefy.ai`
  (`bedrock-claude-sonnet-4-5`). A Claude.ai subscription ≠ API access → proxy is the path.
- **Payment-correctness guards** (added from live demo feedback, all tested):
  - **answer-first** — no charge unless the coach actually answers (`cap:check`/`smoke`).
  - **no-double-charge idempotency** — same question within 2 min → free, shown "on the house" (`idempotency:check`).
  - **buyer-chosen cap via chat** — `authorize_allowance(monthly_cap)`; the buyer names the ceiling ("cap me at €2") (`cap:check`).
  - **hard cap** — server-side, independent of Desktop's approval setting.
- **On-chain link surfaced** prominently (💸/🔗) + server `instructions` so the host calls the coach (not a registry) and always shows the tx link.
- **Earnings bridge — emitter** — CORS-open `GET /earnings` (`EARNINGS_SERVE=1` or `npm run earnings:serve`); listen-error-safe.
- **file-fresh meter** — re-reads `meter.json` each op → `npm run reset` clears state with no restart.
- **Demo tooling**: `desktop:config` (writes Desktop config w/ ABSOLUTE node path), `desktop:verify`, `demo:e2e`, `reset`, plus **DEMO.md** (self-serve setup/run guide).

## Shipped — cross-repo bridge CONSUMER (elopage)
- Branch `1871_mac_agent_earnings_bridge` (off the agentic base), **pushed**, PR:
  https://github.com/elopage/elopage_web_client/pull/7087. `useBackbone` fetch-on-mount → replays each
  earning through `settleOrder` (agent sales → `creator-suite` satellite). tsc-clean.
- Dev server runs on `:3002` (worktree needs `/locales` + `/locales-gen` symlinked from the `agentic` worktree).
- Verified serving; reload the console to re-pull `/earnings`. Seam: `GET http://127.0.0.1:7654/earnings`.

## Next
- **Slice 2b — the real flat-grant spine** (next build piece): `pay_flat` → comped order →
  `order.charge_or_give_access!` → real `MembershipSession` ROW in Postgres; `hasFlatAccess` checks it
  by buyer email. Replaces the in-memory stub. Gives a "purchase wrote a DB row you can SELECT" proof.
  Recon mapped: `Order#charge_or_give_access!` (app/models/order.rb:1142), `MembershipSession`, buyer = `payer.user.email`.
- Then: merge the two PRs once reviewed.

## Key decisions
- **Algorand testnet, not x402/Base**: buyer wallet is server-side → x402's HTTP handshake never exercised in a
  stdio MCP; Algorand gives the real capped on-chain micropayment with less setup. Bounded-allowance pattern kept; `PaymentRail` keeps an x402 adapter possible.
- **Discover is public**; only flat would touch ablefy auth/grant. BE = run-locally dependency; seeds live in THIS repo, never committed into the BE.
- Two modes: €0.10/q on-chain capped (hero, real) + €9 flat (simulated/comped). Human authorizes a bounded, buyer-named cap.

## Gotchas (demo-day)
- **Claude Desktop overwrites `claude_desktop_config.json` if edited while running** → only run `desktop:config` while Desktop is QUIT.
- **Desktop needs the ABSOLUTE node path** (`command`) — its PATH lacks homebrew/nvm node ("spawn node ENOENT"); `desktop:config` handles it.
- **"Always allow" persists** across relaunches — to re-show the approval beat, set tools back to "Ask" in Manage connectors (or rename the connector key for a fresh identity).
- **Fable 5 is flaky for tool-calling** (skips the tools) → use Sonnet 4.5 / Opus.
- **Two webpack dev servers (bridge :3002 + other worktree :3001) → OOM**; the bridge gets killed first. Free the other or keep one.
- **`can_sell` flips back to false post-seed** (BE recomputes without real KYC) — discover still works because the shop query isn't passed `for_shop=true`.
- BE logs via SemanticLogger → Opensearch (no clean request line to tail); prove the BE connection via the data (rows/API/live-edit), not logs.
- BE already runs in Docker (`elopage-rails-app-1` :3000). macOS has no `timeout` (use `gtimeout`/background). TS6 + NodeNext needs `"types":["node"]`.
