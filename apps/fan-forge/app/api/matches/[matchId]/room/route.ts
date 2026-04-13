import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const CHAT_API = process.env.CHAT_API_URL ?? 'http://localhost:3001';

export async function POST(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  // Already has team rooms — return them
  if (match.roomIdRed && match.roomIdBlue) {
    return NextResponse.json({ roomIdRed: match.roomIdRed, roomIdBlue: match.roomIdBlue });
  }

  // Ensure owner user exists in chat-api
  await fetch(`${CHAT_API}/api/auth/me`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: match.ownerWallet }),
  }).catch(() => null);

  // Helper to create a single room
  async function createRoom(teamLabel: string) {
    const res = await fetch(`${CHAT_API}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${match!.name} · ${teamLabel}`,
        walletAddress: match!.ownerWallet,
        recipientWallet: match!.ownerWallet,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create ${teamLabel} room`);
    return res.json() as Promise<{ id: string }>;
  }

  let redRoom: { id: string };
  let blueRoom: { id: string };
  try {
    [redRoom, blueRoom] = await Promise.all([createRoom('Red'), createRoom('Blue')]);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { roomIdRed: redRoom.id, roomIdBlue: blueRoom.id },
  });

  return NextResponse.json({ roomIdRed: redRoom.id, roomIdBlue: blueRoom.id });
}
