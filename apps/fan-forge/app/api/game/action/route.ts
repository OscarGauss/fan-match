import type { NextRequest } from 'next/server'
import type { Team } from '@/lib/types'

interface FanAction {
  type: 'paint_pixel' | 'stake' | 'fund_agent'
  team: Team
  payload: Record<string, unknown>
}

interface ActionResponse {
  success: boolean
  txHash: string
  message: string
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as FanAction

  const validTypes = ['paint_pixel', 'stake', 'fund_agent'] as const
  const validTeams: Team[] = ['red', 'blue']

  if (!validTypes.includes(body.type) || !validTeams.includes(body.team)) {
    return Response.json(
      { success: false, txHash: '', message: 'Invalid action type or team' },
      { status: 400 },
    )
  }

  const response: ActionResponse = {
    success: true,
    txHash: 'mock_tx_123',
    message: 'Action received',
  }

  return Response.json(response)
}
