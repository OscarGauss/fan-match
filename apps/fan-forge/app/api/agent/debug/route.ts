import { getAgentPublicKey, getAgentUSDCBalance } from '@/lib/agents/agentWallet';

/**
 * GET /api/agent/debug
 * Shows config status without exposing any secret keys.
 */
export async function GET() {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasRedSecret = !!process.env.AGENT_RED_SECRET;
  const hasBlueSecret = !!process.env.AGENT_BLUE_SECRET;

  let redPublic = '';
  let bluePublic = '';
  let redBalance: number | null = null;
  let blueBalance: number | null = null;
  let anthropicOk = false;

  try { redPublic = getAgentPublicKey('red'); } catch { /* not set */ }
  try { bluePublic = getAgentPublicKey('blue'); } catch { /* not set */ }
  try { redBalance = await getAgentUSDCBalance('red'); } catch { /* horizon error */ }
  try { blueBalance = await getAgentUSDCBalance('blue'); } catch { /* horizon error */ }

  // Quick ping to Anthropic — just checks auth, no tokens spent
  if (hasAnthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      anthropicOk = res.ok;
    } catch { /* network error */ }
  }

  return Response.json({
    anthropic: {
      keySet: hasAnthropicKey,
      reachable: anthropicOk,
    },
    agents: {
      red: {
        publicKey: redPublic || '(not set)',
        secretSet: hasRedSecret,
        usdcBalance: redBalance,
        canSign: hasRedSecret && !!redPublic,
      },
      blue: {
        publicKey: bluePublic || '(not set)',
        secretSet: hasBlueSecret,
        usdcBalance: blueBalance,
        canSign: hasBlueSecret && !!bluePublic,
      },
    },
    horizonUrl: process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  });
}
