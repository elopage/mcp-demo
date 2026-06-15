# AGENTS.md — mcp-demo

> The **ablefy "pay-to-ask AI coach" agent-commerce demo** — a buyer-side MCP server that lets
> someone discover a creator's AI coach in a normal Claude Desktop chat, pay for access (a real
> on-chain testnet micropayment, or a flat option), and consume it, while the creator's euro
> earnings surface in the ablefy-light console.
>
> Part of the ablefy "agentic future" work. **Full design + context: Jira MAC-1871.**
> Status: **scaffold only** — the build starts next session (see `STATUS.md`).

## What this repo is (planned)
A standalone **Node + TypeScript** MCP server (`@modelcontextprotocol/sdk`), demoed in **Claude
Desktop** over local stdio. It calls:
- the **ablefy backend (Rails), run locally** as a **dependency** — seeded via Rails console / a
  seed script kept *in this repo*. **Never commit demo code or seeds into the production ablefy backend.**
- an **x402 testnet rail** (Base Sepolia) for the real per-question micropayment.
- an **LLM** for the coach's answers.

Two payment modes: **€0.10/question on-chain, capped at €9/month** (the hero — real testnet) and a
**flat €9** option (simulated/comped). The human authorizes payment as a **bounded, capped allowance**
(no open autonomous spend).

## Agentic conventions
<!-- Read by the /agentic-start and /agentic-wrap rituals. Keep current. -->
- Base branch: `master` (single-purpose repo — the MAC-1871 demo; no shared-base/explorations dance).
- PR base: `master`.
- Live-state doc: `STATUS.md` (repo root).
- Exploration pattern: this repo **is** the MAC-1871 exploration; work on feature branches off `master`, PR to `master`.
- Dependency: the ablefy backend is run locally + seeded (seed scripts live here); never commit demo code into it.
- Epic: MAC-1871.
