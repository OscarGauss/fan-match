import type { AgentStats } from '../types';
import { getUpgradeCost, STAT_UPGRADE_AMOUNT, STAT_MAX } from '../constants';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001'; // fast + cheap for real-time decisions

type StatKey = keyof AgentStats;

const STAT_KEYS: StatKey[] = [
  'goalkeeper',
  'defense',
  'midfield',
  'forward',
  'speed',
];

// ── Fallbacks ─────────────────────────────────────────────────────────────────

function fallback(currentStats: AgentStats, usdcAvailable: number): {
  stat: StatKey;
  reasoning: string;
  upgradeAmount: number;
} {
  const lowestStat = STAT_KEYS.reduce((a, b) =>
    currentStats[a] <= currentStats[b] ? a : b,
  );
  const upgradeAmount = maxAffordableUpgrade(currentStats[lowestStat], usdcAvailable);
  return { stat: lowestStat, reasoning: 'upgrading weakest stat', upgradeAmount };
}

function fallbackThought(
  agentId: 'red' | 'blue',
  matchState: {
    score: { red: number; blue: number };
    currentStats: AgentStats;
    usdcReceived: number;
  },
): string {
  const myScore = matchState.score[agentId];
  const oppScore = matchState.score[agentId === 'red' ? 'blue' : 'red'];
  const lowestStat = STAT_KEYS.reduce((a, b) =>
    matchState.currentStats[a] <= matchState.currentStats[b] ? a : b,
  );
  const val = matchState.currentStats[lowestStat];
  if (myScore < oppScore)
    return `down ${oppScore - myScore} — ${lowestStat} at ${val} is my weak spot, send USDC`;
  if (myScore > oppScore)
    return `leading — watching ${lowestStat} at ${val}, ready to reinforce`;
  return `tied — ${lowestStat} at ${val} needs work, send USDC to upgrade`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Max upgrade points the agent can afford given its USDC and current stat value. */
function maxAffordableUpgrade(currentStat: number, usdcAvailable: number): number {
  const costPerStep = getUpgradeCost(currentStat);
  const steps = Math.max(1, Math.floor(usdcAvailable / costPerStep));
  return Math.min(steps * STAT_UPGRADE_AMOUNT, STAT_MAX - currentStat);
}

function truncateReasoning(s: string): string {
  return s.length > 80 ? s.slice(0, 80) : s;
}

function truncateThought(s: string): string {
  const clean = s.replace(/^["']|["']$/g, '').trim();
  return clean.length > 100 ? clean.slice(0, 100) : clean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function callAnthropic(system: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);

  const data = (await res.json()) as { content: { type: string; text: string }[] };
  return data.content.find((c) => c.type === 'text')?.text ?? '';
}

// ── Autonomous thinking ───────────────────────────────────────────────────────

export async function thinkAutonomously(
  agentId: 'red' | 'blue',
  matchState: {
    score: { red: number; blue: number };
    timeRemainingMs: number;
    currentStats: AgentStats;
    usdcReceived: number;
  },
): Promise<string> {
  // Use deterministic fallback — no API call needed for flavor text
  return fallbackThought(agentId, matchState);
}

// ── Upgrade decision ──────────────────────────────────────────────────────────

export async function decideUpgrade(
  agentId: 'red' | 'blue',
  matchState: {
    score: { red: number; blue: number };
    timeRemainingMs: number;
    currentStats: AgentStats;
  },
  usdcReceived: number,
): Promise<{ stat: StatKey; reasoning: string; upgradeAmount: number }> {
  const { score, timeRemainingMs, currentStats } = matchState;
  const agentName = agentId === 'red' ? 'AgentRed' : 'AgentBlue';

  // Calculate the max upgrade this agent can afford with available USDC
  // (pick the chosen stat's cost — we'll use the weakest stat's cost as estimate for the prompt)
  const weakest = STAT_KEYS.reduce((a, b) => currentStats[a] <= currentStats[b] ? a : b);
  const maxUpgrade = maxAffordableUpgrade(currentStats[weakest], usdcReceived);

  try {
    const text = await callAnthropic(
      `You are ${agentName}, an autonomous AI foosball agent. You just received USDC from fans. ` +
      `Decide which stat to upgrade to maximize winning chances. Be aggressive — spend all available USDC.\n` +
      `Stats: goalkeeper, defense, midfield, forward, speed (all 0-100).\n` +
      `Max upgrade this turn: ${maxUpgrade} points (use it fully).\n` +
      `Respond ONLY with valid JSON, no markdown:\n` +
      `{"stat":"goalkeeper|defense|midfield|forward|speed","reasoning":"max 80 chars","upgradeAmount":number}`,
      `Score ${score.red}-${score.blue}, time left ${formatTime(timeRemainingMs)}.\n` +
      `Stats: GK=${currentStats.goalkeeper} DEF=${currentStats.defense} ` +
      `MID=${currentStats.midfield} FWD=${currentStats.forward} SPD=${currentStats.speed}.\n` +
      `Received: ${usdcReceived} USDC. Max upgrade: ${maxUpgrade}. Decide.`,
      150,
    );

    const parsed = JSON.parse(text) as {
      stat: string;
      reasoning: string;
      upgradeAmount: number;
    };

    const stat = STAT_KEYS.includes(parsed.stat as StatKey)
      ? (parsed.stat as StatKey)
      : fallback(currentStats, usdcReceived).stat;

    // Clamp to what the agent can actually afford for the chosen stat
    const affordableForStat = maxAffordableUpgrade(currentStats[stat], usdcReceived);
    const upgradeAmount = Math.min(
      Math.max(STAT_UPGRADE_AMOUNT, Number(parsed.upgradeAmount)),
      affordableForStat,
    );

    return {
      stat,
      reasoning: truncateReasoning(String(parsed.reasoning ?? '')),
      upgradeAmount,
    };
  } catch {
    return fallback(currentStats, usdcReceived);
  }
}
