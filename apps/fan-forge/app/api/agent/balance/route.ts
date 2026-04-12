import { getAgentPublicKey, getAgentUSDCBalance } from '@/lib/agents/agentWallet';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId');

  if (!agentId || (agentId !== 'red' && agentId !== 'blue')) {
    return Response.json(
      { error: "agentId must be 'red' or 'blue'" },
      { status: 400 },
    );
  }

  const publicKey = getAgentPublicKey(agentId);
  const balance = await getAgentUSDCBalance(agentId);

  return Response.json({ agentId, balance, publicKey });
}
