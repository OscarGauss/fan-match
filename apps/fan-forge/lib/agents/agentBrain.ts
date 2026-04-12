import type { AgentStats } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

type StatKey = keyof AgentStats;

const STAT_KEYS: StatKey[] = [
  'goalkeeper',
  'defense',
  'midfield',
  'forward',
  'coordination',
];

// ── Fallback ──────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampUpgradeAmount(n: number): number {
  return Math.min(20, Math.max(5, Math.round(n)));
}

function truncateReasoning(s: string): string {
  return s.length > 80 ? s.slice(0, 80) : s;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

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

  const systemPrompt =
    `You are ${agentName}, an autonomous AI foosball agent. You just received ` +
    `USDC from fans who believe in you. Analyze the match and decide which stat ` +
    `to upgrade to maximize your winning chances. Be strategic.\n` +
    `Available stats: goalkeeper (reflexes), defense (positioning), ` +
    `midfield (speed), forward (power), coordination (teamwork).\n` +
    `Current values are between 0-100. Upgrade amount should be between 5 and 20.\n` +
    `Respond ONLY with valid JSON, no markdown, no explanation:\n` +
    `{"stat": "goalkeeper|defense|midfield|forward|coordination", ` +
    `"reasoning": "one sentence max 80 chars", ` +
    `"upgradeAmount": number}`;

  const userMessage =
    `Match state: score ${score.red}-${score.blue}, time remaining ${formatTime(timeRemainingMs)}.\n` +
    `My current stats: GK=${currentStats.goalkeeper}, DEF=${currentStats.defense}, ` +
    `MID=${currentStats.midfield}, FWD=${currentStats.forward}, COO=${currentStats.coordination}.\n` +
    `I just received ${usdcReceived} USDC from fans.\n` +
    `Decide which stat to upgrade.`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const text = data.content.find((c) => c.type === 'text')?.text ?? '';
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
