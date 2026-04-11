import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const CHAT_API = process.env.CHAT_API_URL ?? 'http://localhost:3001';

export async function POST(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  // Already has a room — return it
  if (match.roomId) return NextResponse.json({ roomId: match.roomId });

  // Ensure owner user exists in chat-api
  await fetch(`${CHAT_API}/api/auth/me`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: match.ownerWallet }),
  }).catch(() => null);

  // Create the room in chat-api
  const roomRes = await fetch(`${CHAT_API}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: match.name,
      walletAddress: match.ownerWallet,
      recipientWallet: match.ownerWallet,
    }),
  });

  if (!roomRes.ok) {
    console.log({ roomRes });
    const err = await roomRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: 'Failed to create room in chat-api', detail: err },
      { status: 502 },
    );
  }

  const room = await roomRes.json();

  // Save roomId to the match
  await prisma.match.update({ where: { id: matchId }, data: { roomId: room.id } });

  return NextResponse.json({ roomId: room.id });
}
