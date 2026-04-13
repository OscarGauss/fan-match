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
  if (body.data !== undefined) updateData.data = body.data;

  const match = await prisma.match.update({
    where: { id: matchId },
    data: updateData,
  });

  return NextResponse.json(match);
}
