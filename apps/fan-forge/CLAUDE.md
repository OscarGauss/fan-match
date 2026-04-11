# FanForge — Project Context

## What is FanForge

Real-time multiplayer game where two AI agents play an autonomous foosball match while fans compete to influence the outcome. Every economic action is a real Stellar testnet transaction.

Built for the **Agents on Stellar Hackathon 2026**.

---

## Match Structure — 5 minutes total

```
0:00 → match starts, staking opens
1:00 → Grid Event #1 starts (60 sec)
2:00 → Grid Event #1 ends
2:30 → Grid Event #2 starts (60 sec) / staking closes
3:30 → Grid Event #2 ends
4:00 → Grid Event #3 starts (60 sec)
5:00 → match ends → Soroban auto-payout
```

---

## Core Rules

- Match is exactly **5 minutes**. Do not change this.
- There are exactly **3 Grid Events** at 1:00, 2:30, and 4:00. Each lasts 60 seconds.
- **Staking closes at 2:30** — enforce this on both frontend and backend.
- No 3D. Match simulation is **2D Canvas**, top-down view.
- Each pixel painted = 1 Stellar transaction (0.01 USDC).
- Agents reason **autonomously** — fans send funds, agents decide alone what to upgrade.
- Payout is **automatic** via Soroban contract — never manual.
- Users never see wallets or seed phrases — Pollar handles that invisibly.
- Chat is **emoji-only** — never implement free text in match chat.
- During Grid Event, the chat area is **fully replaced** by the pixel grid.

---

## AI Agents

Two agents total, one per team:
- `AgentRed` — controls Team A
- `AgentBlue` — controls Team B

Each agent has its own Stellar wallet. When it receives USDC from fans it runs this cycle:

```
1. Receives funds on Stellar wallet
2. Analyzes match state (score, time left, which role is underperforming)
3. Autonomously decides which stat to upgrade
4. Announces decision in the decision log
5. Applies upgrade to the match engine
```

If no one funds an agent, it plays with base stats — no upgrades.

### Upgradeable stats

| Role | Stat |
|------|------|
| Goalkeeper | Reflexes |
| Defense | Positioning |
| Midfield | Speed |
| Forward | Power |

### Decision log format

```
[1:14] AgentRed · received 0.08 USDC from fan_0x3a
[1:14] AgentRed · analyzing: score 0-1, defense losing duels
[1:15] AgentRed · → upgrading defense positioning
[1:15] tx confirmed · GABCD...XYZ → contract · 0.08 USDC · stellar testnet
```

---

## Grid Event

- Same grid for both teams
- Team A paints red, Team B paints blue
- Each fan starts with 3 free pixels per event
- Additional pixels purchasable with USDC
- Target figure shown — teams must complete it with their color
- Score = % of target figure completed by your color (precision over volume)
- Winning team gets x1.5 stat boost for their agent for 60 seconds

---

## Economy

| User action | Stellar action |
|-------------|---------------|
| Paints a pixel | 0.01 USDC → agent wallet |
| Buys extra pixels | USDC → game contract |
| Stakes on team | USDC locked in Soroban contract |
| Wins match | Contract auto-distributes payout |

Staking is open from match start until minute 2:30. Winners receive their stake back plus a proportional share of the losing pool.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind v4 |
| Animations | Framer Motion |
| Match simulation | 2D Canvas (top-down, no 3D) |
| AI agents | Rule-based autonomous logic |
| Real-time | WebSockets (socket.io) |
| Blockchain | Stellar testnet + Soroban |
| Wallet | Pollar (invisible to user) |
| Micropayments | x402 on Stellar |

---

## UI Layout (desktop)

```
┌─────────────────────────────────────────────────────┐
│  FanForge        [timer]        [score]    [profile] │
├──────────────────────────┬──────────────────────────┤
│                          │  AGENTS                  │
│      MATCH               │  AgentRed  0.23 USDC     │
│   (2D Canvas)            │  [stat bars]             │
│                          │  AgentBlue 0.11 USDC     │
│   [play-by-play feed]    │  [stat bars]             │
│                          ├──────────────────────────┤
├──────────────────────────┤  AGENT DECISIONS         │
│   EMOJI CHAT             │  real-time reasoning log │
│   (replaced by grid      │  + Stellar tx confirms   │
│    during Grid Event)    │                          │
└──────────────────────────┴──────────────────────────┘
```

---

## File Structure

```
fan-forge/
├── app/
│   ├── api/
│   │   ├── game/
│   │   │   ├── state/route.ts       # GET: match state
│   │   │   ├── action/route.ts      # POST: fan actions
│   │   │   └── stake/route.ts       # POST: stake on team
│   │   └── agent/
│   │       └── decision/route.ts    # SSE: agent decision log
│   ├── game/page.tsx                # main match screen
│   ├── page.tsx                     # lobby / team selection
│   └── globals.css
│
├── components/
│   ├── game/
│   │   ├── MatchCanvas.tsx          # 2D Canvas simulation
│   │   ├── MatchFeed.tsx            # play-by-play text feed
│   │   ├── GridEvent.tsx            # interactive pixel grid
│   │   ├── AgentPanel.tsx           # agent stats + wallet
│   │   ├── AgentDecisionLog.tsx     # agent reasoning log
│   │   ├── EmojiChat.tsx            # emoji-only chat
│   │   └── StakePanel.tsx           # staking UI
│   └── ui/
│       └── Button.tsx
│
├── lib/
│   ├── constants.ts                 # match duration, event times, prices
│   ├── types.ts                     # TypeScript interfaces
│   ├── gameEngine.ts                # match logic + physics
│   ├── agentLogic.ts                # autonomous agent reasoning
│   └── stellar.ts                   # Stellar transaction helpers
│
└── CLAUDE.md
```