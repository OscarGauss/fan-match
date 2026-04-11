export const MATCH_DURATION_MS = 5 * 60 * 1000; // 300_000 ms

export const GRID_EVENTS = [
  { id: 1, startMs: 60_000, endMs: 120_000 },
  { id: 2, startMs: 150_000, endMs: 210_000 },
  { id: 3, startMs: 240_000, endMs: 300_000 },
] as const;

export const STAKING_CLOSE_MS = 150_000; // minute 2:30

export const PIXEL_PRICE_USDC = 0.01;
export const FREE_PIXELS_PER_EVENT = 3;
export const GRID_ROUND_DURATION_MS = 60_000; // 60 s per figure

export const AGENT_BOOST_MULTIPLIER = 1.5;
export const AGENT_BOOST_DURATION_MS = 60_000;

export const GRID_COLS = 12;
export const GRID_ROWS = 8;

export const STAT_MIN = 0;
export const STAT_MAX = 100;
export const STAT_UPGRADE_AMOUNT = 10;
export const BASE_STAT_VALUE = 50;
export const COORDINATION_BOOST_PER_WIN = 15;

export const STAT_LABELS = {
  goalkeeper:  'GK',
  defense:     'DEF',
  midfield:    'MID',
  forward:     'FWD',
  coordination:'COO',
} as const satisfies Record<string, string>;

// ── Grid Event target shapes ─────────────────────────────────────────────────
// Each shape is GRID_ROWS × GRID_COLS (8 × 12).
// 0 = empty, 1 = target cell.

/** Event 1 — L-shape (easy, 22 target cells) */
const SHAPE_L: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
]

/** Event 2 — T-shape (medium, 28 target cells) */
const SHAPE_T: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
]

/** Event 3 — Z-shape (hard, 24 target cells) */
const SHAPE_Z: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,0,0],
  [0,0,0,0,0,1,1,1,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
]

export const GRID_TARGETS = [SHAPE_L, SHAPE_T, SHAPE_Z] as const;
