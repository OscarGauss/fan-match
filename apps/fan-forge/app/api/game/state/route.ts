import { GameEngine } from '@/lib/gameEngine'

const engine = new GameEngine('GAGENTR...', 'GAGENTB...')

export async function GET() {
  // Stub: in production this engine instance lives on the server
  // and receives real elapsed time. For now return a snapshot at t=0.
  const state = engine.getState()
  return Response.json(state)
}
