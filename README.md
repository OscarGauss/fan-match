# FanForge

FanForge is a **Massively Multiplayer Online Stadium** built for the [Stellar Agents x402 Stripe MPP Hackathon](https://dorahacks.io/hackathon/stellar-agents-x402-stripe-mpp/detail).

Two AI agents (powered by Claude claude-sonnet-4-20250514) play an autonomous foosball match while thousands of fans coordinate tactics and send real Stellar micropayments to influence the outcome — all in 5 minutes.

---

## How It Works

### Match Loop (5 minutes total)

```
0:00  Match starts — staking opens
1:00  Grid Event #1 (L-shape, 60 s)   ← pixel canvas replaces chat
2:00  Grid Event #1 ends
2:30  Grid Event #2 (T-shape, 60 s)   ← staking closes
3:30  Grid Event #2 ends
4:00  Grid Event #3 (Z-shape, 60 s)
5:00  Match ends — Soroban auto-payout
```

### The Agent Funding Flow

When a fan sends USDC to an agent wallet, `POST /api/agent/fund` runs:

1. **Verify on Horizon** — fetches `GET /transactions/{txHash}/payments` and confirms a USDC payment landed on the correct agent public key.
2. **Read match state** — current score, elapsed time, agent stats from `GameEngine`.
3. **Ask Claude** — calls `claude-sonnet-4-20250514` with a structured JSON prompt (score, time remaining, current stats, USDC received). The model returns `{ stat, reasoning, upgradeAmount }`.
4. **Fallback** — if the API call fails, upgrades the lowest stat automatically.
5. **Return decision log** — four timestamped entries (`received_funds`, `analyzing`, `decision`, `tx_confirmed`) shown in the UI in real-time.

```ts
// lib/agents/agentBrain.ts
const decision = await decideUpgrade(agentId, {
  score: state.score,
  timeRemainingMs,
  currentStats,
}, amountUsdc);
```

### Grid Events — The Pixel Canvas

- Grid size: **12 × 8** cells
- 3 progressive shapes: **L** (22 target cells), **T** (28), **Z** (24)
- Each fan gets **3 free pixels** per event; additional pixels cost **0.01 USDC** each
- Score = % of target shape covered by your color
- Winning team gets **×1.5 stat boost** for 60 seconds

---

## Architecture

```
┌─────────────────────────────────────────────┐
│            fan-forge (Next.js 16)           │
│                                             │
│  app/page.tsx          → lobby / match list │
│  app/game/page.tsx     → match screen       │
│                                             │
│  API routes:                                │
│  POST /api/agent/fund      Stellar verify   │
│                            + Claude decide  │
│  GET  /api/agent/balance   Horizon balance  │
│  GET  /api/game/state      GameEngine state │
│  POST /api/game/action     fan actions      │
│  POST /api/matches         create match     │
│  GET  /api/matches/[id]    match details    │
│  PATCH /api/matches/[id]   update score /   │
│                            startedAt / data │
│  POST /api/matches/[id]/room → chat-api     │
└───────────────┬─────────────────────────────┘
                │ HTTP
┌───────────────▼─────────────────────────────┐
│            chat-api (Next.js 16)            │
│                                             │
│  POST /api/auth/me           upsert user    │
│  POST /api/rooms             create room    │
│  GET  /api/rooms/[id]        room details   │
│  POST /api/rooms/[id]/messages              │
│  GET  /api/rooms/[id]/ably-token            │
│  POST /api/rooms/[id]/gifts  Stellar verify │
│                              + Ably publish │
│  POST /api/rooms/[id]/reactions             │
│  POST /api/rooms/[id]/bans                  │
└───────────────┬─────────────────────────────┘
                │ pub/sub
┌───────────────▼──────┐   ┌───────────────────┐
│       Ably           │   │  Stellar testnet   │
│  per-team channels   │   │  Horizon API       │
│  (red / blue rooms)  │   │  USDC (testnet)    │
└──────────────────────┘   └───────────────────┘
```

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | Next.js 16 + React 19 + Tailwind v4 |
| Animations | Framer Motion |
| Match simulation | 2D Canvas (top-down view) |
| AI agents | Claude claude-sonnet-4-20250514 via Anthropic API |
| Real-time | Ably (per-team Pub/Sub channels) |
| Blockchain | Stellar testnet + `@stellar/stellar-sdk` |
| Wallet layer | Pollar v0.6.0 (invisible to the user) |
| Micropayments | x402 on Stellar (USDC) |
| Database | PostgreSQL via Prisma |
| Package manager | npm workspaces |

---

## Monorepo

```
fan-match/
├── apps/
│   ├── fan-forge/          # game UI + agent API
│   └── chat-api/           # real-time chat service
└── packages/
    └── live-chat/          # shared chat primitives
```

### fan-forge

```
apps/fan-forge/
├── app/
│   ├── api/
│   │   ├── agent/
│   │   │   ├── fund/route.ts       # Stellar verify → Claude decide → log
│   │   │   └── balance/route.ts    # Horizon USDC balance
│   │   ├── game/
│   │   │   ├── state/route.ts      # GET GameEngine state
│   │   │   └── action/route.ts     # POST fan actions (paint, stake)
│   │   └── matches/
│   │       ├── route.ts            # GET list / POST create
│   │       └── [matchId]/
│   │           ├── route.ts        # GET / PATCH (score, startedAt, data)
│   │           └── room/route.ts   # POST → create Ably rooms in chat-api
│   ├── game/page.tsx
│   └── page.tsx
├── components/game/
│   ├── MatchCanvas.tsx     # 2D Canvas simulation
│   ├── MatchView.tsx       # top-level game layout
│   ├── GridEvent.tsx       # pixel canvas (L / T / Z shapes)
│   ├── AgentPanel.tsx      # stat bars + wallet balance
│   ├── AgentDecisionLog.tsx# real-time reasoning feed
│   ├── EmojiChat.tsx       # emoji-only fan chat
│   ├── TeamChat.tsx        # Ably-backed per-team chat
│   ├── StakePanel.tsx      # stake on team
│   ├── MoraleBar.tsx       # morale visualization
│   └── RadarChart.tsx      # agent stat radar
└── lib/
    ├── agents/
    │   ├── agentBrain.ts   # Claude API call + fallback heuristic
    │   └── agentWallet.ts  # Horizon: balance, send USDC, poll payments
    ├── gameEngine.ts       # match logic + physics
    ├── agentLogic.ts       # stat application
    ├── constants.ts        # all magic numbers (see below)
    ├── types.ts            # TypeScript interfaces
    └── prisma.ts           # Prisma client singleton
```

### chat-api

```
apps/chat-api/src/
├── app/api/
│   ├── auth/me/route.ts                    # upsert User by walletAddress
│   ├── rooms/
│   │   ├── route.ts                        # create room
│   │   └── [roomId]/
│   │       ├── route.ts                    # room details
│   │       ├── ably-token/route.ts         # Ably token auth
│   │       ├── messages/route.ts           # send / list messages
│   │       ├── gifts/
│   │       │   ├── route.ts               # send gift (Stellar verify + Ably publish)
│   │       │   └── config/route.ts        # enabled gifts per room
│   │       ├── reactions/
│   │       │   ├── route.ts               # send reaction
│   │       │   └── config/route.ts        # enabled reactions per room
│   │       ├── members/route.ts            # room membership
│   │       └── bans/route.ts              # ban management
└── lib/
    ├── ably-server.ts      # Ably server-side publish helper
    ├── stellar.ts          # verifyGiftPayment (Horizon lookup)
    └── prisma.ts
```

---

## Database Schemas

### fan-forge — `Match`

```prisma
model Match {
  id          String      @id @default(cuid())
  name        String
  ownerWallet String                         // Stellar G-address
  roomIdRed   String?                        // Ably room id (red team)
  roomIdBlue  String?                        // Ably room id (blue team)
  status      MatchStatus @default(WAITING)  // WAITING | ACTIVE | FINISHED
  startedAt   DateTime?                      // wall-clock start (derived finish state)
  scoreRed    Int         @default(0)
  scoreBlue   Int         @default(0)
  data        Json?                          // generic blob for future use
}
```

### chat-api — key models

```prisma
model User {
  walletAddress String @unique   // Pollar Stellar G-address
  username      String?
  avatarColor   String
}

model Room {
  recipientWallet String?        // receives gift payments (defaults to owner)
  slowModeSeconds Int            // 0 = disabled
}

model GiftType {
  slug        String @id        // 'rose', 'ball', 'trophy' ...
  priceAmount String            // decimal string e.g. "0.50"
  priceAsset  String            // "USDC"
}

model GiftEvent {
  txHash String?                // Stellar tx hash — verified before recording
}
```

---

## Key Constants

```ts
// lib/constants.ts
MATCH_DURATION_MS      = 300_000   // 5 minutes
STAKING_CLOSE_MS       = 150_000   // 2:30 — no more stakes after this

GRID_EVENTS = [
  { id: 1, startMs: 60_000,  endMs: 120_000 },   // L-shape (22 cells)
  { id: 2, startMs: 150_000, endMs: 210_000 },   // T-shape (28 cells)
  { id: 3, startMs: 240_000, endMs: 300_000 },   // Z-shape (24 cells)
]

GRID_COLS              = 12
GRID_ROWS              = 8
PIXEL_PRICE_USDC       = 0.01
FREE_PIXELS_PER_EVENT  = 3

BASE_STAT_VALUE        = 50
STAT_UPGRADE_AMOUNT    = 10        // per Claude decision (5–20, clamped)
STAT_MAX               = 100
AGENT_BOOST_MULTIPLIER = 1.5       // Grid Event win bonus
AGENT_BOOST_DURATION_MS= 60_000
COORDINATION_BOOST_PER_WIN = 15
```

---

## Agent State Shape

```ts
interface AgentState {
  team: 'red' | 'blue';
  walletAddress: string;    // Stellar G-address (read from env)
  usdcReceived: number;
  stats: {
    goalkeeper: number;     // 0–100 Reflexes
    defense: number;        // 0–100 Positioning
    midfield: number;       // 0–100 Speed
    forward: number;        // 0–100 Power
    coordination: number;   // 0–100 Teamwork (boosted by Grid Event wins)
  };
  activeBoost: boolean;
  boostExpiresAt: number | null;
}
```

---

## Environment Variables

### fan-forge `.env.local`

```
DATABASE_URL=
ANTHROPIC_API_KEY=

AGENT_RED_PUBLIC=          # Stellar G-address
AGENT_RED_SECRET=          # Stellar S-address
AGENT_BLUE_PUBLIC=
AGENT_BLUE_SECRET=

USDC_ISSUER=               # testnet USDC issuer address
HORIZON_URL=https://horizon-testnet.stellar.org

CHAT_API_URL=http://localhost:3001

NEXT_PUBLIC_POLLAR_APP_ID=
```

### chat-api `.env.local`

```
DATABASE_URL=
ABLY_API_KEY=
NEXT_PUBLIC_POLLAR_APP_ID=
```

---

## Local Development

**Prerequisites:** Node.js 20+

```bash
# Install all workspace dependencies
npm install

# Start both apps (two terminals)
npm run dev:fan-forge   # http://localhost:3000
npm run dev:chat-api    # http://localhost:3001

# Database (defaults to fan-forge)
npm run db:push                    # fan-forge schema
npm run db:push -- chat-api        # chat-api schema
npm run db:studio                  # Prisma Studio (fan-forge)
npm run db:studio -- chat-api      # Prisma Studio (chat-api)
```

---

## Team

| | Name |
| - | ---- |
| Blues | Alejandro |
| Referee | Oscar Gauss |
| Reds | Chrix |
