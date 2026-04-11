import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/rooms/[roomId]/members
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const members = await prisma.roomMember.findMany({
    where: { roomId },
    include: {
      user: { select: { id: true, username: true, walletAddress: true, avatarColor: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(members);
}

// POST /api/rooms/[roomId]/members — add a moderator (owner only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { callerWallet, targetWallet, role } = body as {
    callerWallet?: string;
    targetWallet?: string;
    role?: string;
  };

  if (!callerWallet || !targetWallet) {
    return Response.json({ error: "callerWallet and targetWallet are required" }, { status: 400 });
  }

  if (role !== "MODERATOR") {
    return Response.json({ error: "Only MODERATOR role can be assigned via this endpoint" }, { status: 400 });
  }

  const caller = await prisma.user.findUnique({ where: { walletAddress: callerWallet } });
  if (!caller) return Response.json({ error: "Caller not found" }, { status: 404 });

  const callerMembership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: caller.id } },
  });

  if (!callerMembership || callerMembership.role !== "OWNER") {
    return Response.json({ error: "Only the room owner can assign moderators" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { walletAddress: targetWallet } });
  if (!target) return Response.json({ error: "Target user not found" }, { status: 404 });

  const member = await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId, userId: target.id } },
    update: { role: "MODERATOR" },
    create: { roomId, userId: target.id, role: "MODERATOR" },
    include: { user: { select: { id: true, username: true, walletAddress: true } } },
  });

  return Response.json(member, { status: 201 });
}

// DELETE /api/rooms/[roomId]/members — remove a moderator (owner only)
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

  const callerMembership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: caller.id } },
  });

  if (!callerMembership || callerMembership.role !== "OWNER") {
    return Response.json({ error: "Only the room owner can remove moderators" }, { status: 403 });
  }

  await prisma.roomMember.deleteMany({
    where: { roomId, userId: targetUserId, role: "MODERATOR" },
  });

  return new Response(null, { status: 204 });
}
