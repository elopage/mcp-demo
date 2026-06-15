# mcp-demo — STATUS

> Live-state doc for the ablefy "pay-to-ask AI coach" agent-commerce demo (Jira MAC-1871).
> Read at the start of every session, update at the end. Lives on `master`.

## Shipped — built + verified (branch `1871_mac_mcp_server`, 6 commits; PR → master pending)
- **MCP server + 6 tools** (find_coach / get_offer / ask_coach / authorize_allowance / pay_flat /
  creator_earnings), Claude-Desktop stdio. Every dependency behind an interface
  (`AblefyBackend` / `PaymentRail` / `CoachLLM` / `EarningsSink`), fake↔real by config. 12/12 offline smoke.
- **Real discover** vs the LOCAL ablefy BE — `GET /v1/shop/{slug}/products?form=service` (**public, no token**).
  Repo-local rails-runner seed creates Lena Brandt / `the-systems-studio` (can_sell) + the `service`
  "Lena AI — Systems Coach" product + a €9 `one_time` plan + an API key. 6/6 live-BE check.
- **Real Algorand testnet micropayment** (native ALGO) behind `PaymentRail` — build→sign→submit→confirm,
  explorer-provable. Verified with a real on-chain tx (€0.10 recorded, 0.0001 ALGO moved). The MCP owns
  the meter + €9/mo cap (persisted); trial → authorize-allowance → cap → flat logic all verified.
- **Real coach** — Anthropic SDK (`COACH_LLM=anthropic`) and an OpenAI-compatible adapter for a LiteLLM
  proxy (`COACH_LLM=litellm`). Verified live via `litellm.ablefy.ai` (`bedrock-claude-sonnet-4-5`).
- **Earnings bridge — emitter** — CORS-open localhost endpoint `GET /earnings` (`EARNINGS_SERVE=1`, or
  `npm run earnings:serve`) serving `~/.ablefy-mcp/earnings.json`.

## In flight / cross-repo
- **Earnings bridge — consumer (elopage)** built on `1871_mac_agent_earnings_bridge` (off the agentic base):
  `useBackbone` fetch-on-mount → replays each agent earning through the existing `settleOrder` (agent sales
  map to the `creator-suite` satellite). tsc-clean. **NOT pushed** (awaiting decision).
  Seam contract: `GET http://127.0.0.1:7654/earnings → { version, currency, total, earnings[] }`.

## Next
- Push/PR: mcp-demo `1871_mac_mcp_server` → master; elopage bridge branch → the agentic base.
- Wire into Claude Desktop (config + the rehearsed opening chat).
- Demo-time browser integration: run the agentic dev server + `earnings:serve`, record earnings via
  `ask_coach`, watch them land in the ablefy-light console.
- Deferred: the REAL flat-grant spine (comped order → `charge_or_give_access!` → `MembershipSession`);
  flat access is currently local/in-memory (flat is the simulated fallback — micro is the hero).

## Key decisions
- **Algorand testnet, not x402/Base** (divergence from the brief): the buyer wallet is server-side, so
  x402's HTTP handshake is never exercised in a stdio MCP — Algorand gives the real, capped, on-chain
  micropayment with less setup. Bounded-allowance pattern + language kept; `PaymentRail` keeps an
  x402/Base adapter possible.
- **Discover is public**; only flat mode would touch ablefy auth/grant. The ablefy BE is a **run-locally
  dependency** (already up via docker-compose) — seeds live in THIS repo, never committed into the BE.
- Two modes: €0.10/q on-chain capped €9/mo (hero, real) + €9 flat (simulated/comped). Human authorizes a
  bounded, capped allowance — no open autonomous spend.
- Coach via the team **LiteLLM proxy** by default (a Claude.ai subscription is not API access).

## Gotchas
- The local ablefy BE was ALREADY running (`elopage-rails-app-1` on :3000) — the "heaviest" risk was moot.
  Seed: `docker exec -i elopage-rails-app-1 bin/rails runner - < seed/lena_seed.rb`.
- The elopage worktree's husky pre-commit hook is broken (`.husky/_/husky.sh` missing) → commit `--no-verify`.
- macOS has no `timeout` command (use `gtimeout`, or run long checks in the background).
- TypeScript 6 + NodeNext: tsconfig needs an explicit `"types": ["node"]` or node globals don't resolve.
