'use client';

import { useMemo } from 'react';
import type { MatchState, Team } from '@/lib/types';

/**
 * Extracts agent stats for a given team from matchState.
 * `coordination` doubles as the speed/velocity stat — it drives
 * how fast all rods move on the canvas.
 *
 * Usage:
 *   const { goalkeeper, defense, midfield, forward, coordination } = useAgentStats(matchState, 'red');
 */
export interface AgentStatView {
  goalkeeper: number;   // arquero  — GK width
  defense: number;      // defensa  — DEF width
  midfield: number;     // mediocamp — MID width
  forward: number;      // ataque   — FWD width
  coordination: number; // velocidad — all-rod speed multiplier
}

export function useAgentStats(matchState: MatchState, team: Team): AgentStatView {
  const stats = matchState.agents[team].stats;
  return useMemo(
    () => ({
      goalkeeper: stats.goalkeeper,
      defense: stats.defense,
      midfield: stats.midfield,
      forward: stats.forward,
      coordination: stats.coordination,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats.goalkeeper, stats.defense, stats.midfield, stats.forward, stats.coordination, team],
  );
}
