import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToRoom } from "@/lib/ably-server";

// GET /api/rooms/[roomId]/bans — list banned users (mod/owner)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const callerWallet = request.nextUrl.searchParams.get("wallet");

  if (!callerWallet) {
    return Response.json({ error: "wallet param required" }, { status: 400 });
  }

  const caller = await prisma.user.findUnique({ where: { walletAddress: callerWallet } });
  if (!caller) return Response.json({ error: "User not found" }, { status: 404 });

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: caller.id } },
  });

  if (!membership || !["OWNER", "MODERATOR"].includes(membership.role)) {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const bans = await prisma.ban.findMany({
    where: { roomId },
    include: { user: { select: { id: true, username: true, walletAddress: true } } },
    orderBy: { bannedAt: "desc" },
  });

  return Response.json(bans);
}

// POST /api/rooms/[roomId]/bans — ban a user (mod/owner)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { callerWallet, targetUserId } = body as {
    callerWallet?: string;
    targetUserId?: string;
  };

  if (!callerWallet || !targetUserId) {
    return Response.json({ error: "callerWallet and targetUserId are required" }, { status: 400 });
  }

  const caller = await prisma.user.findUnique({ where: { walletAddress: callerWallet } });
  if (!caller) return Response.json({ error: "Caller not found" }, { status: 404 });

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: caller.id } },
  });

  if (!membership || !["OWNER", "MODERATOR"].includes(membership.role)) {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Can't ban another mod or owner
  const targetMembership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: targetUserId } },
  });

  if (targetMembership && ["OWNER", "MODERATOR"].includes(targetMembership.role)) {
    return Response.json({ error: "Cannot ban a moderator or owner" }, { status: 400 });
  }

  const ban = await prisma.ban.upsert({
    where: { roomId_userId: { roomId, userId: targetUserId } },
    update: {},
    create: { roomId, userId: targetUserId },
  });

  await publishToRoom(roomId, "user.banned", { userId: targetUserId });

  return Response.json(ban, { status: 201 });
}

// DELETE /api/rooms/[roomId]/bans — unban a user (mod/owner)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { callerWallet, targetUserId } = body as {
    callerWallet?: string;
    targetUserId?: string;
  };

  if (!callerWallet || !targetUserId) {
    return Response.json({ error: "callerWallet and targetUserId are required" }, { status: 400 });
  }

  const caller = await prisma.user.findUnique({ where: { walletAddress: callerWallet } });
  if (!caller) return Response.json({ error: "Caller not found" }, { status: 404 });

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: caller.id } },
  });

  if (!membership || !["OWNER", "MODERATOR"].includes(membership.role)) {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  await prisma.ban.deleteMany({ where: { roomId, userId: targetUserId } });

  return new Response(null, { status: 204 });
}
