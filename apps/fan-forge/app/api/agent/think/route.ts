import type { NextRequest } from 'next/server';
import { thinkAutonomously, decideUpgrade } from '@/lib/agents/agentBrain';
import { agentSendUSDC } from '@/lib/agents/agentWallet';
import { MATCH_DURATION_MS, STAT_MAX, getUpgradeCost } from '@/lib/constants';
import type { AgentStats, DecisionLogEntry, Team } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      agentId: unknown;
      score: unknown;
      elapsedMs: unknown;
      stats: unknown;
      usdcReceived: unknown;
      availableUsdc: unknown;
    };

    const { agentId, score, elapsedMs, stats, usdcReceived, availableUsdc } = body;

    if (!agentId || (agentId !== 'red' && agentId !== 'blue')) {
      return Response.json({ error: "agentId must be 'red' or 'blue'" }, { status: 400 });
    }

    const elapsed = Number(elapsedMs) || 0;
    const timeRemainingMs = Math.max(0, MATCH_DURATION_MS - elapsed);
    const available = Number(availableUsdc) || 0;
    const currentStats = stats as AgentStats;
    const currentScore = (score as { red: number; blue: number }) ?? { red: 0, blue: 0 };
    const team = agentId as Team;

    // Cost of next upgrade — based on the lowest (cheapest) upgradeable stat
    const statKeys = Object.keys(currentStats) as (keyof AgentStats)[];
    const upgradeableStats = statKeys.filter((k) => currentStats[k] < STAT_MAX);

    // All stats maxed — nothing to spend on
    if (upgradeableStats.length === 0) {
      return Response.json({
        logEntries: [{
          timestamp: elapsed,
          team,
          type: 'thinking' as const,
          message: 'all stats maxed at 100 — holding funds',
        }],
        needsFunds: false,
      });
    }

    const lowestStatValue = Math.min(...upgradeableStats.map((k) => currentStats[k]));
    const minCost = getUpgradeCost(lowestStatValue);

    // ── Has enough USDC — decide and act ─────────────────────────────────────
    if (available >= minCost) {
      const decision = await decideUpgrade(
        team,
        { score: currentScore, timeRemainingMs, currentStats },
        available,
      );

      const upgradeCost = getUpgradeCost(currentStats[decision.stat]);
      const oldValue = currentStats[decision.stat];
      const newValue = Math.min(STAT_MAX, oldValue + decision.upgradeAmount);

      // ── Real Stellar transaction ──────────────────────────────────────────
      // Agent pays the game treasury — each upgrade permanently spends USDC
      // from the agent's wallet, reducing its balance.
      const treasury = process.env.GAME_TREASURY ?? '';
      let txHash: string | null = null;
      let txError: string | null = null;
      try {
        if (!treasury) throw new Error('Missing env var: GAME_TREASURY');
        const result = await agentSendUSDC(team, treasury, upgradeCost.toFixed(7));
        if (result.success && result.txHash) {
          txHash = result.txHash;
        } else {
          txError = result.error ?? 'unknown error';
        }
      } catch (e) {
        txError = e instanceof Error ? e.message : String(e);
      }

      const shortHash = txHash
        ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
        : null;

      const logEntries: DecisionLogEntry[] = [
        {
          timestamp: elapsed,
          team,
          type: 'analyzing',
          message: `analyzing: score ${currentScore.red}-${currentScore.blue}, ${available.toFixed(2)} USDC available`,
        },
        {
          timestamp: elapsed,
          team,
          type: 'decision',
          message: `→ ${decision.reasoning} (${oldValue} → ${newValue})`,
        },
        {
          timestamp: elapsed,
          team,
          type: 'tx_confirmed',
          message: txHash
            ? `${shortHash} · ${upgradeCost.toFixed(2)} USDC · stellar testnet`
            : txError
              ? `tx failed: ${txError.slice(0, 60)}`
              : `${upgradeCost.toFixed(2)} USDC spent · ${decision.stat} upgraded`,
        },
      ];

      return Response.json({
        logEntries,
        upgrade: {
          stat: decision.stat,
          amount: decision.upgradeAmount,
          cost: upgradeCost,
        },
        txHash,
      });
    }

    // ── Broke — think and ask for help ────────────────────────────────────────
    const thought = await thinkAutonomously(team, {
      score: currentScore,
      timeRemainingMs,
      currentStats,
      usdcReceived: Number(usdcReceived) || 0,
    });

    return Response.json({
      logEntries: [{ timestamp: elapsed, team, type: 'thinking', message: thought }],
      needsFunds: true,
      nextUpgradeCost: minCost,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return Response.json({ error }, { status: 500 });
  }
}
