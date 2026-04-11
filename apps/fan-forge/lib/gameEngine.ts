import {
  MATCH_DURATION_MS,
  GRID_EVENTS,
  STAKING_CLOSE_MS,
  GRID_COLS,
  GRID_ROWS,
  FREE_PIXELS_PER_EVENT,
  AGENT_BOOST_MULTIPLIER,
  AGENT_BOOST_DURATION_MS,
  STAT_MAX,
  STAT_UPGRADE_AMOUNT,
  BASE_STAT_VALUE,
  COORDINATION_BOOST_PER_WIN,
  GRID_TARGETS,
} from './constants';
import { decideUpgrade } from './agentLogic';
import type {
  Team,
  AgentState,
  AgentStats,
  MatchState,
  GridEventState,
  DecisionLogEntry,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(): AgentStats {
  return {
    goalkeeper:   BASE_STAT_VALUE,
    defense:      BASE_STAT_VALUE,
    midfield:     BASE_STAT_VALUE,
    forward:      BASE_STAT_VALUE,
    coordination: BASE_STAT_VALUE,
  };
}

function makeAgent(team: Team, walletAddress: string): AgentState {
  return {
    team,
    walletAddress,
    usdcReceived: 0,
    stats: makeStats(),
    activeBoost: false,
    boostExpiresAt: null,
  };
}

function emptyGrid(): number[][] {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
}

/**
 * Generates a simple target shape for a Grid Event.
 * The shape is a pseudo-random blob seeded by the event id so it's
 * deterministic between server and client.
 */
function generateTargetShape(eventId: number): number[][] {
  const shape = emptyGrid();
  // Simple deterministic pattern: fill a diamond centred in the grid
  const cx = Math.floor(GRID_COLS / 2);
  const cy = Math.floor(GRID_ROWS / 2);
  const radius = 2 + (eventId % 2); // radius 2 or 3
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (Math.abs(r - cy) + Math.abs(c - cx) <= radius) {
        shape[r][c] = 1;
      }
    }
  }
  return shape;
}

// ---------------------------------------------------------------------------
// GameEngine
// ---------------------------------------------------------------------------

export class GameEngine {
  private state: MatchState;

  constructor(redWallet = '', blueWallet = '') {
    this.state = {
      status: 'waiting',
      elapsedMs: 0,
      score: { red: 0, blue: 0 },
      agents: {
        red: makeAgent('red', redWallet),
        blue: makeAgent('blue', blueWallet),
      },
      currentGridEvent: null,
      stakingOpen: true,
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Advances match state to the given elapsed time.
   * Call this on every server tick with the real wall-clock offset from match start.
   *
   * @param elapsedMs - Milliseconds since match start
   * @returns Updated MatchState (same reference — clone if you need immutability)
   */
  tick(elapsedMs: number): MatchState {
    this.state.elapsedMs = elapsedMs;

    // Expire active boosts
    for (const team of ['red', 'blue'] as Team[]) {
      const agent = this.state.agents[team];
      if (agent.activeBoost && agent.boostExpiresAt !== null && elapsedMs >= agent.boostExpiresAt) {
        agent.activeBoost = false;
        agent.boostExpiresAt = null;
      }
    }

    // Staking window
    this.state.stakingOpen = this.isStakingOpen(elapsedMs);

    // Match status
    if (elapsedMs >= MATCH_DURATION_MS) {
      this.state.status = 'finished';
      this.state.currentGridEvent = null;
      return this.state;
    }

    const activeEvent = this.getActiveGridEvent(elapsedMs);
    if (activeEvent !== null) {
      this.state.status = 'grid_event';
      // Preserve painted grid when re-entering the same event
      if (this.state.currentGridEvent?.id !== activeEvent.id) {
        this.state.currentGridEvent = activeEvent;
      }
    } else {
      this.state.status = 'active';
      this.state.currentGridEvent = null;
    }

    return this.state;
  }

  /**
   * Increments the score for the given team by 1.
   *
   * @param team - Team that scored
   * @returns Updated score object
   */
  processGoal(team: Team): MatchState['score'] {
    this.state.score[team] += 1;
    return { ...this.state.score };
  }

  /**
   * Records incoming USDC for a team's agent, triggers the autonomous decision
   * cycle, and upgrades the chosen stat.
   *
   * @param team        - Which agent receives the funds
   * @param amountUsdc  - Amount received in USDC
   * @returns Three DecisionLogEntry items: received_funds → analyzing → decision
   */
  applyAgentFunding(team: Team, amountUsdc: number): DecisionLogEntry[] {
    const agent = this.state.agents[team];
    agent.usdcReceived += amountUsdc;

    const now = this.state.elapsedMs;
    const statKey = decideUpgrade(team, agent.stats, this.state.score);
    const oldValue = agent.stats[statKey];
    agent.stats[statKey] = Math.min(STAT_MAX, oldValue + STAT_UPGRADE_AMOUNT);

    const statLabels: Record<keyof AgentStats, string> = {
      goalkeeper:   'goalkeeper reflexes',
      defense:      'defense positioning',
      midfield:     'midfield speed',
      forward:      'forward power',
      coordination: 'team coordination',
    };

    const scoreStr = `score ${this.state.score.red}-${this.state.score.blue}`;
    const isLosing = this.state.score[team] < this.state.score[team === 'red' ? 'blue' : 'red'];

    return [
      {
        timestamp: now,
        team,
        type: 'received_funds',
        message: `received ${amountUsdc.toFixed(2)} USDC`,
      },
      {
        timestamp: now,
        team,
        type: 'analyzing',
        message: `analyzing: ${scoreStr}, ${isLosing ? 'losing — checking defense' : 'ahead — checking attack'}`,
      },
      {
        timestamp: now,
        team,
        type: 'decision',
        message: `→ upgrading ${statLabels[statKey]} (${oldValue} → ${agent.stats[statKey]})`,
      },
    ];
  }

  /**
   * Applies an x1.5 stat boost to the winning team's agent for 60 seconds.
   * The boost multiplies all stat values (capped at STAT_MAX).
   *
   * @param winner    - Team that won the Grid Event
   */
  applyGridEventResult(winner: Team): void {
    const agent = this.state.agents[winner];
    const stats = agent.stats;

    for (const key of Object.keys(stats) as (keyof AgentStats)[]) {
      stats[key] = Math.min(STAT_MAX, Math.round(stats[key] * AGENT_BOOST_MULTIPLIER));
    }

    // Grid Event win also boosts coordination
    stats.coordination = Math.min(STAT_MAX, stats.coordination + COORDINATION_BOOST_PER_WIN);

    agent.activeBoost = true;
    agent.boostExpiresAt = this.state.elapsedMs + AGENT_BOOST_DURATION_MS;
  }

  /**
   * Returns the GridEventState for the currently active Grid Event,
   * or null if no event is running at the given elapsed time.
   *
   * @param elapsedMs - Milliseconds since match start
   */
  getActiveGridEvent(elapsedMs: number): GridEventState | null {
    const def = GRID_EVENTS.find(
      (e) => elapsedMs >= e.startMs && elapsedMs < e.endMs,
    );
    if (!def) return null;

    // Preserve the existing grid if we're still in the same event
    if (this.state.currentGridEvent?.id === def.id) {
      return this.state.currentGridEvent;
    }

    return {
      id: def.id,
      grid: emptyGrid(),
      targetShape: GRID_TARGETS[def.id - 1] as number[][],
      startMs: def.startMs,
      endMs: def.endMs,
      pixelsLeft: {
        red: FREE_PIXELS_PER_EVENT,
        blue: FREE_PIXELS_PER_EVENT,
      },
    };
  }

  /**
   * Returns whether fans can still stake on the outcome.
   * Staking closes at STAKING_CLOSE_MS (minute 2:30).
   *
   * @param elapsedMs - Milliseconds since match start
   */
  isStakingOpen(elapsedMs: number): boolean {
    return elapsedMs < STAKING_CLOSE_MS;
  }

  /** Returns a shallow copy of the current match state. */
  getState(): MatchState {
    return { ...this.state };
  }
}
