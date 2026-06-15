# ablefy-mcp — pay-to-ask AI coach (MAC-1871)

A buyer-side **MCP server** for **Claude Desktop**: in a normal chat you discover a creator's
AI coach, **pay per question** (a real on-chain micropayment, capped monthly) or go **flat**
for unlimited — while the creator's euro earnings surface in their ablefy-light console.

> *"ablefy is the payment + access layer for agent-mediated creator commerce — including
> agent-native micropayments."* — Act 3 of the agentic-future arc. Full design: **Jira MAC-1871.**

## Status — slice 1 of 4 (built)

| Slice | Scope | State |
|---|---|---|
| **1** | MCP server + all 6 tools, end-to-end on **fakes** (in-memory ablefy, mock rail, canned coach) | ✅ **built** — runs in Claude Desktop today |
| 2 | Real **local ablefy Rails backend** (docker-compose + seed) behind discover + flat mode | next |
| 3 | Real **Algorand testnet** micropayment + on-chain meter/cap | next |
| 4 | Real **LLM** coach + the cross-repo **earnings bridge** consumer (elopage side) | next |

Slice 1 swaps to real implementations purely by config — every dependency sits behind an
interface (`AblefyBackend`, `PaymentRail`, `CoachLLM`, `EarningsSink`).

## Quickstart

```bash
npm install
npm run build      # tsc → dist/
npm run smoke      # drives the server over stdio, asserts the full flow
```

## Wire into Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`, then restart Claude
Desktop — the `ablefy_*` tools appear. Slice 1 needs **no secrets** (defaults to mock rail +
canned coach):

```json
{
  "mcpServers": {
    "ablefy": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-demo/dist/index.js"],
      "env": {
        "PRICE_PER_Q": "0.10",
        "MONTHLY_CAP": "9.00",
        "PAYMENT_RAIL": "mock",
        "COACH_LLM": "fake"
      }
    }
  }
}
```

Later slices add `ABLEFY_API_BASE` + `ABLEFY_SELLER_TOKEN` (slice 2), `ALGOD_URL` /
`BUYER_WALLET_MNEMONIC` / `CREATOR_ADDRESS` with `PAYMENT_RAIL=algorand` (slice 3), and
`ANTHROPIC_API_KEY` with `COACH_LLM=anthropic` (slice 4). See [.env.example](.env.example).

**Suggested approval config for the demo:** `find_coach` / `get_offer` always-allow;
`ask_coach`, `authorize_allowance`, `pay_flat` on-ask — so each payment is a deliberate beat.

## Tools

| Tool | Does |
|---|---|
| `ablefy_find_coach` | Discover a coach + both prices |
| `ablefy_get_offer` | Full offer: both payment modes |
| `ablefy_ask_coach` | Ask one question. Flat → free; else takes the per-question micropayment + enforces the cap. First ask = the paid trial |
| `ablefy_authorize_allowance` | Approve the bounded allowance (€0.10/q ≤ €9/mo) once |
| `ablefy_pay_flat` | Comped €9 order → access grant → unlimited |
| `ablefy_creator_earnings` | Creator's euro earnings (the console view) |

## Architecture

```
Claude Desktop ──stdio──► ablefy-mcp (owns the METER + CAP)
                            ├── discover / flat ──► AblefyBackend  (fake → real local Rails)
                            ├── per-question pay ─► PaymentRail    (mock → Algorand testnet)
                            ├── answer ───────────► CoachLLM       (canned → real LLM)
                            └── records earnings ─► EarningsSink   (local JSON: the console bridge)
```

### The earnings bridge (cross-repo seam)

This repo is the **emitter**: it writes earnings to a stable local contract at
`~/.ablefy-mcp/earnings.json`:

```json
{ "version": 1, "currency": "EUR", "earnings": [ /* Earning[] */ ] }
```

The **consumer** is a later, separate change in `elopage_web_client` (the ablefy-light console,
Act 1) that reads this file into its ledger. The two are coordinated through the hub seam
contract — **never cross-committed**.

## Notes

- **Algorand, not x402/Base.** The brief named x402, but the buyer wallet lives server-side, so
  the x402 wire handshake is never exercised — the demo just needs a real, capped, on-chain
  micropayment, which Algorand testnet delivers with less setup. The bounded-allowance *pattern*
  and language are kept; the `PaymentRail` interface keeps an x402/Base adapter possible later.
- **Never log to stdout** — it's the JSON-RPC channel. Logs go to stderr.
- The ablefy backend is a **run-locally dependency**; demo code/seeds never land in it.
