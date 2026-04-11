import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/rooms — list active rooms
export async function GET() {
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    include: {
      members: { include: { user: { select: { id: true, username: true, walletAddress: true } } } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(rooms);
}

// POST /api/rooms — create a room
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, walletAddress, recipientWallet } = body as {
    name?: string;
    description?: string;
    walletAddress?: string;
    recipientWallet?: string;
  };

  if (!name || !walletAddress) {
    return Response.json({ error: "name and walletAddress are required" }, { status: 400 });
  }

  // Ensure user exists
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) {
    return Response.json({ error: "User not found. Call /api/auth/me first." }, { status: 404 });
  }

  // Get all gift types to populate room gift config
  const giftTypes = await prisma.giftType.findMany();

  const room = await prisma.room.create({
    data: {
      name,
      description: description ?? null,
      recipientWallet: recipientWallet ?? null,
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
      giftConfig: {
        create: giftTypes.map((g) => ({ giftSlug: g.slug, isEnabled: true })),
      },
    },
    include: {
      members: { include: { user: { select: { id: true, username: true, walletAddress: true } } } },
      giftConfig: { include: { gift: true } },
    },
  });

  return Response.json(room, { status: 201 });
}
