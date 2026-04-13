import type { AgentStats } from '../types';

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

function fallback(currentStats: AgentStats): {
  stat: StatKey;
  reasoning: string;
  upgradeAmount: number;
} {
  const lowestStat = STAT_KEYS.reduce((a, b) =>
    currentStats[a] <= currentStats[b] ? a : b,
  );
  return { stat: lowestStat, reasoning: 'upgrading weakest stat', upgradeAmount: 10 };
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

function clampUpgradeAmount(n: number): number {
  return Math.min(20, Math.max(5, Math.round(n)));
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

  try {
    const text = await callAnthropic(
      `You are ${agentName}, an autonomous AI foosball agent. You just received USDC from fans. ` +
      `Decide which stat to upgrade to maximize winning chances. Be strategic.\n` +
      `Stats: goalkeeper, defense, midfield, forward, speed (all 0-100).\n` +
      `Upgrade amount: 5-20.\n` +
      `Respond ONLY with valid JSON, no markdown:\n` +
      `{"stat":"goalkeeper|defense|midfield|forward|speed","reasoning":"max 80 chars","upgradeAmount":number}`,
      `Score ${score.red}-${score.blue}, time left ${formatTime(timeRemainingMs)}.\n` +
      `Stats: GK=${currentStats.goalkeeper} DEF=${currentStats.defense} ` +
      `MID=${currentStats.midfield} FWD=${currentStats.forward} SPD=${currentStats.speed}.\n` +
      `Received: ${usdcReceived} USDC. Decide.`,
      150,
    );

    const parsed = JSON.parse(text) as {
      stat: string;
      reasoning: string;
      upgradeAmount: number;
    };

    const stat = STAT_KEYS.includes(parsed.stat as StatKey)
      ? (parsed.stat as StatKey)
      : fallback(currentStats).stat;

    return {
      stat,
      reasoning: truncateReasoning(String(parsed.reasoning ?? '')),
      upgradeAmount: clampUpgradeAmount(Number(parsed.upgradeAmount)),
    };
  } catch {
    return fallback(currentStats);
  }
}
