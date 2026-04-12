import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToRoom } from "@/lib/ably-server";

const MESSAGE_PAGE_SIZE = 50;

// GET /api/rooms/[roomId]/messages?cursor=<createdAt>&limit=50
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? String(MESSAGE_PAGE_SIZE), 10),
    100
  );

  const messages = await prisma.message.findMany({
    where: {
      roomId,
      isDeleted: false,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      user: { select: { id: true, username: true, walletAddress: true, avatarColor: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return Response.json(messages.reverse());
}

// POST /api/rooms/[roomId]/messages — send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { content, walletAddress, clientMsgId } = body as {
    content?: string;
    walletAddress?: string;
    clientMsgId?: string;
  };

  if (!content?.trim() || !walletAddress) {
    return Response.json({ error: "content and walletAddress are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Check if user is banned in this room
  const ban = await prisma.ban.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (ban) return Response.json({ error: "You are banned from this room" }, { status: 403 });

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) {
    return Response.json({ error: "Room not found or inactive" }, { status: 404 });
  }

  // Use client-provided ID if valid UUID (enables optimistic UI dedup), else generate one
  const isValidUUID = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
  const messageId =
    clientMsgId && isValidUUID(clientMsgId) ? clientMsgId : crypto.randomUUID();
  const now = new Date();

  // Publish to Ably immediately — don't await so subscribers see it before DB write finishes
  publishToRoom(roomId, "message.new", {
    id: messageId,
    content: content.trim(),
    type: "text",
    roomId,
    userId: user.id,
    createdAt: now.toISOString(),
    isDeleted: false,
    user: {
      id: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      avatarColor: user.avatarColor,
    },
  });

  const message = await prisma.message.create({
    data: { id: messageId, content: content.trim(), roomId, userId: user.id, createdAt: now },
    include: {
      user: { select: { id: true, username: true, walletAddress: true, avatarColor: true } },
    },
  });

  return Response.json(message, { status: 201 });
}
