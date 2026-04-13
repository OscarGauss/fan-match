# FanForge — AI Agents on Stellar

> Built for the **Agents on Stellar Hackathon 2026**

FanForge is a real-time multiplayer foosball game where two autonomous AI agents compete while fans fund them with USDC on Stellar testnet. Every upgrade is a real on-chain micropayment. Every decision is made by Claude.

---

## How the AI works

### The two agents

| Agent | Team | Wallet |
|---|---|---|
| AgentRed | Red | Stellar testnet keypair (`AGENT_RED_*`) |
| AgentBlue | Blue | Stellar testnet keypair (`AGENT_BLUE_*`) |

Each agent has five upgradeable stats that directly affect gameplay on the canvas:

| Stat | Visual effect |
|---|---|
| `goalkeeper` | GK player gets wider — blocks more area |
| `defense` | Defenders get wider |
| `midfield` | Midfielders get wider |
| `forward` | Forwards get wider + hit the ball harder |
| `coordination` | **All players move faster** (speed multiplier 0.6× → 1.4×) |

---

### The decision loop

When a fan sends USDC to an agent's Stellar wallet, this cycle triggers immediately:

```
Fan sends USDC
      ↓
Balance detected (Horizon polling)
      ↓
POST /api/agent/think
      ↓
Claude (claude-haiku-4-5) analyzes:
  - Current score
  - Time remaining
  - All 5 stat values
  - Available USDC
      ↓
Returns: { stat, upgradeAmount, reasoning }
      ↓
Agent signs a Stellar transaction → pays game treasury
      ↓
Stat applied to game engine
      ↓
Canvas updates in real time
      ↓
If still enough USDC → upgrade again (1.5s chain)
```

If the agent has no funds, it generates a deterministic thought ("tied — midfield at 50 needs work, send USDC") without any API call.

---

### Progressive upgrade costs

Upgrading a stat costs more the higher it already is:

| Stat value | Cost per upgrade |
|---|---|
| 0 – 59 | 0.05 USDC |
| 60 – 74 | 0.10 USDC |
| 75 – 89 | 0.20 USDC |
| 90 – 100 | 0.40 USDC |

A fully maxed agent (all stats at 100) stops spending — there's nothing left to upgrade.

---

### Real Stellar transactions

Every upgrade sends USDC from the agent's wallet to the game treasury:

```
AGENT_RED wallet  →  GAME_TREASURY  (0.05–0.40 USDC)
```

The treasury address is `GCT7D6S5VTFGEURS6ZYIO33YZRPQMA3LNWB4GEOHDFDXZGWTA4EPIM5E`.

Each transaction is confirmed on Stellar testnet and the hash appears in the Agent Decisions log. You can verify any transaction at [stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet).

---

### Agent intelligence

Claude receives a compact prompt with match context and responds with JSON:

```json
{ "stat": "defense", "reasoning": "losing 2-1, defense at 50 is the weak spot", "upgradeAmount": 10 }
```

Claude only gets called when the agent **has funds to spend** — idle thoughts use a deterministic fallback (zero API cost). This keeps the hackathon demo economically viable.

---

## Architecture

```
Fan sends USDC on Stellar
         │
         ▼
  Horizon polling (15s)
  detects balance change
         │
         ▼
  runAgentThink() [client]
         │
         ▼
  POST /api/agent/think [server]
  ├── decideUpgrade() → Claude API
  └── agentSendUSDC() → Stellar SDK
         │
         ▼
  upgrade applied to GameEngine
  stats saved to DB via PATCH /api/matches/[matchId]
         │
         ▼
  MatchCanvas re-renders
  (player width + speed update in RAF loop)
```

---

## Key files

| File | Purpose |
|---|---|
| `app/api/agent/think/route.ts` | Core agent loop — Claude decision + Stellar tx |
| `app/api/agent/balance/route.ts` | Reads live USDC balance from Horizon |
| `app/api/agent/debug/route.ts` | Diagnostics — check keys, balances, Anthropic reachability |
| `lib/agents/agentBrain.ts` | Claude prompts for upgrade decisions |
| `lib/agents/agentWallet.ts` | Stellar SDK — sign and submit USDC payments |
| `lib/hooks/useAgentStats.ts` | React hook exposing `{ goalkeeper, defense, midfield, forward, coordination }` |
| `components/game/MatchCanvas.tsx` | 2D canvas — players width and speed driven by stats |
| `components/game/AgentPanel.tsx` | Agent UI — live balance, radar chart, fund button |
| `lib/constants.ts` | `getUpgradeCost()` — progressive pricing |

---

## Environment variables

```bash
# Agent wallets (Stellar testnet keypairs)
AGENT_RED_PUBLIC=G...
AGENT_RED_SECRET=S...
AGENT_BLUE_PUBLIC=G...
AGENT_BLUE_SECRET=S...

# Game treasury — receives USDC spent on upgrades
GAME_TREASURY=GCT7D6S5VTFGEURS6ZYIO33YZRPQMA3LNWB4GEOHDFDXZGWTA4EPIM5E

# Stellar network
USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
HORIZON_URL=https://horizon-testnet.stellar.org

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgresql://...

# Auth
NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_...
```

### Setting up agent wallets

1. Generate two keypairs at [laboratory.stellar.org](https://laboratory.stellar.org/#account-creator?network=test)
2. Fund with testnet XLM via [Friendbot](https://friendbot.stellar.org)
3. Add USDC trustline and get testnet USDC from [Circle Faucet](https://faucet.circle.com) (select Stellar Testnet)
4. Add both keypairs to `.env.local`

### Verify everything is wired up

```
GET /api/agent/debug
```

Returns Anthropic reachability, agent public keys, USDC balances, and whether each agent can sign transactions.

---

## Running locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).
