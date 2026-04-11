import type { Team, AgentStats } from './types';

/**
 * Decides which stat the agent should upgrade next based on match context.
 *
 * Strategy:
 * - Losing team → prioritise the lowest defensive stat (goalkeeper or defense)
 * - Winning or tied team → prioritise the lowest offensive stat (midfield or forward)
 *
 * @param team   - The agent's team ('red' | 'blue')
 * @param stats  - Current stat values for the agent
 * @param score  - Current match score
 * @returns The key of the stat to upgrade
 */
export function decideUpgrade(
  team: Team,
  stats: AgentStats,
  score: { red: number; blue: number },
): keyof AgentStats {
  const teamScore = score[team];
  const opponentScore = score[team === 'red' ? 'blue' : 'red'];
  const isLosing = teamScore < opponentScore;

  if (isLosing) {
    return stats.goalkeeper <= stats.defense ? 'goalkeeper' : 'defense';
  }

  return stats.midfield <= stats.forward ? 'midfield' : 'forward';
}
