# Demo setup & run guide (MAC-1871)

Plain notes for running the "pay-to-ask AI coach" demo in Claude Desktop yourself.
Most of this is already set up on this machine — the **Run it** and **Reset** sections
are what you'll use day to day.

---

## What the demo shows
In a normal Claude Desktop chat the connector appears as **"Ask Lena"** (creator mode, default).
Discover Lena's AI coach → pay **€0.10/question** on a real Algorand testnet payment (capped,
you choose the cap) → get a real coaching answer → or go **€9 flat**. Her euro earnings show up
in the ablefy-light console. A buyer onboarding page is available at `http://127.0.0.1:7655/`
(start with `WEB_SERVE=1` or `npm run web:serve`).

The 4 moving parts:
- **ablefy backend** (real Rails + Postgres) — runs locally in Docker, holds Lena's product. (discover)
- **Algorand testnet** — the real €0.10 payments.
- **LiteLLM proxy** — the coach's answers (Claude via `litellm.ablefy.ai`).
- **The MCP server** (this repo) — owns the meter/cap, glues it together, runs inside Claude Desktop.

---

## One-time setup (already done here — for reference / a fresh machine)

```bash
npm install
npm run build
```

**`.env`** — copy and fill 5 values (the rest are pre-set):
```bash
cp .env.example .env        # then edit:
#   BUYER_WALLET_MNEMONIC = your funded testnet wallet's 25 words
#   CREATOR_ADDRESS       = any testnet address (receives)
#   LLM_BASE_URL          = https://litellm.ablefy.ai/v1
#   LLM_API_KEY           = your litellm key
#   COACH_MODEL           = bedrock-claude-sonnet-4-5
# Optional overrides (defaults are fine for Story 2 demo):
#   CONNECTOR_MODE        = creator (default) | marketplace
#   CONNECTOR_NAME        = Ask Lena (default in creator mode)
#   WEB_SERVE             = 1  (start buyer page on port 7655 alongside the MCP)
```

**Backend** must be running (Docker): the container `elopage-rails-app-1` on `localhost:3000`.
Seed Lena (only once, or after a DB wipe):
```bash
docker exec -i elopage-rails-app-1 bin/rails runner - < seed/lena_seed.rb
```

**Wire it into Claude Desktop** — IMPORTANT: quit Desktop first (it overwrites the config file if it's open):
```bash
# 1. Fully quit Claude Desktop (Cmd+Q)
npm run desktop:config      # writes the ablefy server into Desktop's config
# 2. Open Claude Desktop
npm run desktop:verify      # sanity check: should say "6 tools"
```

---

## Run it (the demo)

1. **Before each run, reset:**
   ```bash
   npm run reset             # fresh trial, full €9 cap, €0 earnings
   ```
2. **In Claude Desktop**, make sure the payment tools are set to **"Ask"** (not "Always allow"),
   so the approval pop-up shows — that's the human-in-the-loop beat. (Connectors → Manage
   connectors → `Ask Lena` → set `ask_coach` / `authorize_allowance` / `pay_flat` to "Ask".)
3. **New chat**, paste the opening line:
   > I'm drowning in notes across Notion, Obsidian, and random docs. I want a real system for
   > my second brain, but every video says something different. Is there someone who actually
   > knows this stuff that I could just ask?
4. **The beats:**
   - Claude surfaces **Lena AI — Systems Coach** with both prices.
   - You ask a question → **approve the €0.10** → answer comes back with a 🔗 explorer link (the real on-chain payment).
   - "Let me keep asking, **cap me at €2/month**" → approve once → ask more, the cap ticks down.
   - "Or just give me unlimited" → **€9 flat** (comped) → writes a **real `MembershipSession`** in
     ablefy's database (the proof below), and every later question is free.
5. **Model:** use **Sonnet 4.5 or Opus** (not Fable 5 — it's been flaky and skips the tools).

---

## See the bridge (earnings in Lena's console)

The console is a separate web app. Keep **Claude Desktop running** (it serves the earnings feed
on port 7654) and the **browser window visible** (animations pause in a hidden tab).

```bash
# bridge dev server (already running on :3002; restart if it died):
cd /Users/chao.xue/Projects/elopage_web_client/.claude/worktrees/1871_mac_agent_earnings_bridge
npm start -- --port 3002
```
Open **http://localhost:3002/cabinet/agentic/ablefylight**. Ask a paid question in Desktop, then
**reload** the console — the agent sale lands in the money spine / orders / payout.

---

## Prove it's real (optional, for skeptics)

**The backend connection** (no edits — just show the data lines up):
```bash
# 1. the real row in ablefy's Postgres
docker exec elopage-rails-app-1 bin/rails runner "puts ActiveRecord::Base.connection.execute(%q{SELECT id,username FROM sellers WHERE username='the-systems-studio'}).to_a.inspect"
# 2. the backend API serving it
curl -s "http://localhost:3000/v1/shop/the-systems-studio/products?form=membership" | python3 -m json.tool
# 3. the MCP pointed at that backend  → ABLEFY_API_BASE = http://localhost:3000
```
…then in Claude, find the coach → same id/name/price. Or, punchier: edit the DB live
(`Product.find(1).update!(name: '…')`) and re-ask — the chat shows the change.

**The on-chain payment:** the 🔗 link in each answer opens the real testnet transaction.

**The flat purchase writes a real DB row:** a `€9 flat` purchase drives ablefy's genuine
access-grant spine — a comped order → `MembershipSession` (the same access row a normal
checkout writes). After buying flat in the demo, SELECT it back (use the buyer's email):
```bash
docker exec -e CHECK_PRODUCT_ID=1 -e CHECK_BUYER_EMAIL="<buyer email>" -i \
  elopage-rails-app-1 bin/rails runner - < seed/check_flat.rb
# → HAS_FLAT_ACCESS=true MEMBERSHIP_SESSION_ID=<id>
```
(Note: the coach is a **membership** product so the grant writes a `MembershipSession`; the
buyer email must be a deliverable address — ablefy's validator rejects `example.com`.)

---

## When things go wrong

- **Tools don't show up / Claude won't call them** → switch the model off Fable 5; fully quit + reopen Desktop.
- **Config keeps reverting** → only run `npm run desktop:config` while Desktop is **quit**.
- **"spawn node ENOENT"** → the config already pins the full node path; re-run `npm run desktop:config` if you upgraded node.
- **Approval pop-up stopped showing** → you clicked "Always allow"; set the tools back to "Ask" (above).
- **Bridge page "can't be reached"** → the dev server died (usually memory). Free the other one
  (`pkill -f "serve.*--port 3001"`) and restart the bridge.
- **Paid but no answer / double charge** → fixed (answer-first + no-double-charge). Make sure Desktop is on the latest build (relaunch after `npm run build`).

---

## Handy commands
| Command | Does |
|---|---|
| `npm run reset` | fresh trial, €9 cap, €0 earnings, flat access re-purchasable |
| `npm run desktop:config` | write the ablefy server into Desktop (quit Desktop first) |
| `npm run desktop:verify` | confirm the server boots with 6 tools |
| `npm run demo:e2e -- "question"` | run the full paid flow from the terminal (real tx + answer) |
| `npm run smoke` | offline logic check (no backend/chain/LLM) |
| `npm run web:serve` | start buyer landing page at `http://127.0.0.1:7655/` (standalone, no MCP) |
| `WEB_SERVE=1` in `.env` | start buyer page alongside the MCP (same process, via Desktop config) |
