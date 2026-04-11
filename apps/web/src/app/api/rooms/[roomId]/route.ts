import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/rooms/[roomId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, walletAddress: true, avatarColor: true } } },
      },
      giftConfig: { include: { gift: true }, orderBy: { gift: { sortOrder: "asc" } } },
    },
  });

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json(room);
}

// PATCH /api/rooms/[roomId] — update room settings (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { walletAddress, slowModeSeconds, recipientWallet, isActive, name, description } = body as {
    walletAddress?: string;
    slowModeSeconds?: number;
    recipientWallet?: string;
    isActive?: boolean;
    name?: string;
    description?: string;
  };

  if (!walletAddress) {
    return Response.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Only OWNER can update room settings
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });

  if (!membership || membership.role !== "OWNER") {
    return Response.json({ error: "Only the room owner can update settings" }, { status: 403 });
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(slowModeSeconds !== undefined && { slowModeSeconds }),
      ...(recipientWallet !== undefined && { recipientWallet }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return Response.json(updated);
}
