import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  return NextResponse.json(match);
}

// PATCH /api/matches/[matchId]
// Body (all fields optional): { startedAt?, scoreRed?, scoreBlue?, data? }
//
// `data` is merged atomically via PostgreSQL's jsonb || operator — concurrent
// callers writing different keys (e.g. agentStats vs decisionLog) never
// overwrite each other.
export async function PATCH(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = await req.json() as {
    startedAt?: number;   // unix ms timestamp
    scoreRed?: number;
    scoreBlue?: number;
    data?: unknown;
  };

  const updateData: Record<string, unknown> = {};

  if (body.startedAt !== undefined) {
    updateData.startedAt = new Date(body.startedAt);
    updateData.status = 'ACTIVE';
  }
  if (body.scoreRed !== undefined) updateData.scoreRed = body.scoreRed;
  if (body.scoreBlue !== undefined) updateData.scoreBlue = body.scoreBlue;

  // Update scalar fields first (if any)
  if (Object.keys(updateData).length > 0) {
    await prisma.match.update({ where: { id: matchId }, data: updateData });
  }

  // Merge `data` atomically with PostgreSQL jsonb || — no read-modify-write race
  if (body.data !== undefined) {
    const patch = JSON.stringify(body.data);
    await prisma.$executeRaw`
      UPDATE "Match"
      SET    data = COALESCE(data, '{}') || ${patch}::jsonb
      WHERE  id   = ${matchId}
    `;
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  return NextResponse.json(match);
}
