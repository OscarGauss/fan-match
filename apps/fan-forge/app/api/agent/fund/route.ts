import type { NextRequest } from 'next/server';
import { GameEngine } from '@/lib/gameEngine';
import { getAgentPublicKey, getAgentUSDCBalance } from '@/lib/agents/agentWallet';
import { decideUpgrade } from '@/lib/agents/agentBrain';
import { MATCH_DURATION_MS } from '@/lib/constants';
import type { DecisionLogEntry } from '@/lib/types';

// ── Singleton engine (mirrors app/api/game/state/route.ts) ───────────────────
const engine = new GameEngine('AGENT_RED_PLACEHOLDER', 'AGENT_BLUE_PLACEHOLDER');

// ── Helpers ───────────────────────────────────────────────────────────────────

const HORIZON = 'https://horizon-testnet.stellar.org';

function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ── POST /api/agent/fund ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      agentId: unknown;
      txHash: unknown;
      fanAddress: unknown;
      amount: unknown;
    };

    const { agentId, txHash, fanAddress, amount } = body;

    if (!agentId || (agentId !== 'red' && agentId !== 'blue')) {
      return Response.json(
        { error: "agentId must be 'red' or 'blue'" },
        { status: 400 },
      );
    }

    if (!txHash || typeof txHash !== 'string') {
      return Response.json({ error: 'txHash is required' }, { status: 400 });
    }

    if (!fanAddress || typeof fanAddress !== 'string') {
      return Response.json({ error: 'fanAddress is required' }, { status: 400 });
    }

    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return Response.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    // ── Step 1: Verify transaction on Horizon ─────────────────────────────────

    const txRes = await fetch(`${HORIZON}/transactions/${txHash}`);
    if (!txRes.ok) {
      return Response.json({ error: 'transaction not found' }, { status: 400 });
    }

    const paymentsRes = await fetch(`${HORIZON}/transactions/${txHash}/payments`);
    if (!paymentsRes.ok) {
      return Response.json({ error: 'transaction not found' }, { status: 400 });
    }

    const paymentsData = (await paymentsRes.json()) as {
      _embedded: {
        records: {
          type: string;
          asset_type: string;
          asset_code?: string;
          asset_issuer?: string;
          to: string;
          amount: string;
        }[];
      };
    };

    const agentPublicKey = getAgentPublicKey(agentId);

    const usdcPayment = paymentsData._embedded.records.find(
      (r) =>
        r.type === 'payment' &&
        r.asset_type === 'credit_alphanum4' &&
        r.asset_code === 'USDC' &&
        r.to === agentPublicKey,
    );

    if (!usdcPayment) {
      return Response.json({ error: 'invalid transaction' }, { status: 400 });
    }

    // ── Step 2: Get current match state ───────────────────────────────────────

    const state = engine.getState();
    const timeRemainingMs = Math.max(0, MATCH_DURATION_MS - state.elapsedMs);
    const currentStats = state.agents[agentId].stats;

    // ── Step 3: Ask agentBrain to decide upgrade ──────────────────────────────

    const decision = await decideUpgrade(
      agentId,
      { score: state.score, timeRemainingMs, currentStats },
      amountNum,
    );

    // ── Step 4: Build decision log entries ────────────────────────────────────

    const now = Date.now();
    const oldValue = currentStats[decision.stat];
    const newValue = oldValue + decision.upgradeAmount;

    const logEntries: DecisionLogEntry[] = [
      {
        timestamp: now,
        team: agentId,
        type: 'received_funds',
        message: `received ${amountNum} USDC from ${shortAddress(fanAddress)}`,
      },
      {
        timestamp: now,
        team: agentId,
        type: 'analyzing',
        message: `analyzing: score ${state.score.red}-${state.score.blue}, ${formatTime(timeRemainingMs)} remaining`,
      },
      {
        timestamp: now,
        team: agentId,
        type: 'decision',
        message: `→ upgrading ${decision.stat} (${oldValue} → ${newValue})`,
      },
      {
        timestamp: now,
        team: agentId,
        type: 'tx_confirmed',
        message: `tx confirmed · ${shortHash(txHash)} · ${amountNum} USDC · stellar testnet`,
      },
    ];

    // ── Step 5: Return ────────────────────────────────────────────────────────

    const agentBalance = await getAgentUSDCBalance(agentId);

    return Response.json({
      success: true,
      decision,
      logEntries,
      agentBalance,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return Response.json({ error }, { status: 500 });
  }
}
