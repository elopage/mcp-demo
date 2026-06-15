# mcp-demo — STATUS

> Live-state doc for the ablefy "pay-to-ask AI coach" agent-commerce demo (Jira MAC-1871).
> Read at the start of every session, update at the end. Lives on `master`.

## Shipped — built, hardened, and VALIDATED LIVE in Claude Desktop
Slices 1–4b **MERGED to master** (PR #1: https://github.com/elopage/mcp-demo/pull/1).
**Slice 2b** (the real flat-grant spine, below) is built + verified + pushed on branch
`1871_mac_mcp_server`, **PR #2 pending**: https://github.com/elopage/mcp-demo/pull/2.
The full arc ran end-to-end in a real Desktop chat: discover → trial €0.10 → buyer-capped
allowance → flat → coach answer → (bridge) earnings in the console.

- **MCP server + 6 tools** behind interfaces (`AblefyBackend`/`PaymentRail`/`CoachLLM`/`EarningsSink`),
  fake↔real by config. 12/12 offline smoke.
- **Real discover** vs the local ablefy BE (`GET /v1/shop/{slug}/products?form=membership`, **public, no token**).
  Repo-local rails-runner seed: Lena Brandt / `the-systems-studio` + **membership** coach product + €9 `one_time` plan + API key.
- **Real flat-grant spine (slice 2b)** — `pay_flat` writes a **real `MembershipSession` row** to the BE's
  Postgres (the "purchase wrote a DB row you can SELECT" proof). A comped (`give_for_free`) order →
  `Sellable#process_membership_session!` → MembershipSession; `hasFlatAccess` is a write-through file cache
  of the real grant (instant hot path, restart-safe), reconciled by an idempotent grant. The MCP shells
  `seed/grant_flat.rb` / `seed/check_flat.rb` via `docker exec … rails runner -` (run-local; no code in the BE).
  Verified: `check:be` 6/6, raw `SELECT … FROM membership_sessions` by buyer email.
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
- **Merge the open PRs once reviewed** — mcp-demo#2 (slice 2b → master; #1 already merged) + elopage#7087 (bridge consumer).
- Optional polish: a `flat:proof` npm script (wraps `seed/check_flat.rb`) for the demo's SELECT beat;
  prune accumulated dev-DB demo rows if a pristine DB is wanted (discover already shows only the one coach).

## Key decisions
- **Algorand testnet, not x402/Base**: buyer wallet is server-side → x402's HTTP handshake never exercised in a
  stdio MCP; Algorand gives the real capped on-chain micropayment with less setup. Bounded-allowance pattern kept; `PaymentRail` keeps an x402 adapter possible.
- **Discover is public**; flat touches ablefy's real grant spine. BE = run-locally dependency; seeds live in THIS repo, never committed into the BE.
- **Coach is a MEMBERSHIP product** (not service): only membership-form products create a `MembershipSession` (`Sellable#process_membership_session!` is gated on `is_membership?`). "Unlimited access to a coach" = a membership anyway. The paper recon missed this gate — it only surfaced when run.
- Two modes: €0.10/q on-chain capped (hero, real) + €9 flat (comped, but writes a **real** MembershipSession). Human authorizes a bounded, buyer-named cap.

## Gotchas (demo-day)
- **Claude Desktop overwrites `claude_desktop_config.json` if edited while running** → only run `desktop:config` while Desktop is QUIT.
- **Desktop needs the ABSOLUTE node path** (`command`) — its PATH lacks homebrew/nvm node ("spawn node ENOENT"); `desktop:config` handles it.
- **"Always allow" persists** across relaunches — to re-show the approval beat, set tools back to "Ask" in Manage connectors (or rename the connector key for a fresh identity).
- **Fable 5 is flaky for tool-calling** (skips the tools) → use Sonnet 4.5 / Opus.
- **Two webpack dev servers (bridge :3002 + other worktree :3001) → OOM**; the bridge gets killed first. Free the other or keep one.
- **`can_sell` flips back to false post-seed** (BE recomputes without real KYC) — discover still works because the shop query isn't passed `for_shop=true`.
- **`/v1/shop` discover filters only by `form` + `is_private(false)`** (`for_shop` is a NO-OP without `?for_shop=true`, so `active`/`can_be_sold_via_shop` don't gate it). It also **caches the list 1h keyed on `max(products.updated_at)`** — `update_columns` doesn't bump `updated_at`, so flag edits go stale. Retire strays via `private: true` **and** bump `updated_at` (the seed does this).
- **Buyer email must pass the `email_address` gem** (`@example.com` rejected on host/MX) → use a deliverable address for flat. Build the comp with **plain AR** — FactoryBot cascades collide on `LegalForm` uniqueness in the dev DB.
- **Flat grant uses `Sellable#process_membership_session!` directly** (the terminal step of `charge_or_give_access!`) — the fuller path drags in checkout-only `Notific` side-effects that fail in a CLI context. Comp = `give_for_free` flag + `payment_form: free`.
- BE logs via SemanticLogger → Opensearch (no clean request line to tail); prove the BE connection via the data (rows/API/live-edit), not logs.
- BE already runs in Docker (`elopage-rails-app-1` :3000). macOS has no `timeout` (use `gtimeout`/background). TS6 + NodeNext needs `"types":["node"]`.
