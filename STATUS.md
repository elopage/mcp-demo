# mcp-demo — STATUS

> Live-state doc for the ablefy "pay-to-ask AI coach" agent-commerce demo (Jira MAC-1871).
> Read at the start of every session, update at the end. Lives on `master`.

## Shipped
- Repo scaffold only: `AGENTS.md` (with the Agentic conventions block) + this `STATUS.md`.

## In flight
- _(nothing yet)_

## Next — the build (MAC-1871)
1. **Stand up the ablefy backend locally** (`docker-compose`) + a **seed script** (a seller with
   `can_sell`, a `service` "Lena AI — Systems Coach" product, a flat €9 plan). ← heaviest/riskiest, do first.
2. The **MCP server** + ~5 tools (find_coach / get_offer / ask_coach / authorize_allowance / pay_flat).
3. The **x402 per-question micropayment** (Base Sepolia testnet) + verification + the €9/mo cap.
4. The **thin bridge** (on-chain pay → comped order on the local backend → access via `charge_or_give_access!`).
5. The **coach LLM** + the **earnings reflection** into the ablefy-light console.
6. Wire into **Claude Desktop** (local stdio) + the rehearsed opening-chat.

## Key decisions
- **Two payment modes:** €0.10/question on-chain (capped €9/mo — the hero) + €9 flat (simulated). The cap = the flat price.
- **Hybrid realness:** local ablefy backend (seeded directly), **real x402 testnet payment**, thin crypto→access bridge. Only the on-chain payment is real-remote.
- **Human authorizes** payment (bounded, capped allowance — no open autonomous spend).
- **Demo surface:** Claude Desktop only (local stdio); remote connector / claude.ai is later.
- **The ablefy backend is a run-locally dependency**, never a commit target for demo code.

## Gotchas
- Local backend stand-up (`docker-compose`) is the heaviest piece — spike it before committing a demo timeline.
- ablefy's fiat rails have a €1 charge floor + no metering primitive → micropayments route on-chain; the flat €9 is comped.
- `can_sell`/KYC wall → seed the seller's flags directly in the local DB (no real KYC).
