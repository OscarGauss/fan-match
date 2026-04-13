export type Team = 'red' | 'blue';

export interface AgentStats {
  /** Goalkeeper reflexes stat (0–100) */
  goalkeeper: number;
  /** Defensive positioning stat (0–100) */
  defense: number;
  /** Midfield speed stat (0–100) */
  midfield: number;
  /** Forward power stat (0–100) */
  forward: number;
  /** Team speed — increases when team wins a Grid Event (0–100) */
  speed: number;
}

export interface AgentState {
  team: Team;
  walletAddress: string;
  usdcReceived: number;
  stats: AgentStats;
  activeBoost: boolean;
  boostExpiresAt: number | null;
}

export interface MatchState {
  status: 'waiting' | 'active' | 'grid_event' | 'finished';
  elapsedMs: number;
  score: { red: number; blue: number };
  agents: { red: AgentState; blue: AgentState };
  currentGridEvent: GridEventState | null;
  stakingOpen: boolean;
}

export interface GridEventState {
  id: number;
  /** 0 = empty, 1 = red, 2 = blue */
  grid: number[][];
  /** 0 = empty, 1 = target cell */
  targetShape: number[][];
  startMs: number;
  endMs: number;
  pixelsLeft: { red: number; blue: number };
}

export type DecisionType = 'received_funds' | 'analyzing' | 'decision' | 'tx_confirmed' | 'thinking';

export interface DecisionLogEntry {
  timestamp: number;
  team: Team;
  type: DecisionType;
  message: string;
}

export interface StakeEntry {
  fanId: string;
  team: Team;
  amountUsdc: number;
  placedAtMs: number;
}
