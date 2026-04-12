import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToRoom } from "@/lib/ably-server";

// GET /api/rooms/[roomId]/reactions — list enabled reactions for this room
// Auto-creates configs for any catalog items the room is missing (default: enabled).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const [allReactionTypes, existingConfigs] = await Promise.all([
    prisma.reactionType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.roomReactionConfig.findMany({ where: { roomId } }),
  ]);

  const existingSlugs = new Set(existingConfigs.map((c) => c.reactionSlug));
  const missing = allReactionTypes.filter((r) => !existingSlugs.has(r.slug));

  if (missing.length > 0) {
    await prisma.roomReactionConfig.createMany({
      data: missing.map((r) => ({ roomId, reactionSlug: r.slug, isEnabled: true })),
      skipDuplicates: true,
    });
  }

  const configs = await prisma.roomReactionConfig.findMany({
    where: { roomId, isEnabled: true },
    include: { reaction: true },
    orderBy: { reaction: { sortOrder: "asc" } },
  });

  const reactions = configs.map((c) => ({
    slug: c.reaction.slug,
    emoji: c.reaction.emoji,
    label: c.reaction.label,
  }));

  return Response.json(reactions);
}

// POST /api/rooms/[roomId]/reactions — send a reaction (real-time only, no DB event)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { walletAddress, reactionSlug, clientMsgId } = body as {
    walletAddress?: string;
    reactionSlug?: string;
    clientMsgId?: string;
  };

  if (!walletAddress || !reactionSlug) {
    return Response.json({ error: "walletAddress and reactionSlug are required" }, { status: 400 });
  }

  const config = await prisma.roomReactionConfig.findUnique({
    where: { roomId_reactionSlug: { roomId, reactionSlug } },
    include: { reaction: true },
  });

  if (!config || !config.isEnabled) {
    return Response.json({ error: "Reaction not available in this room" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Use client-provided ID if valid UUID (enables optimistic UI dedup), else generate one
  const isValidUUID = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
  const messageId =
    clientMsgId && isValidUUID(clientMsgId) ? clientMsgId : crypto.randomUUID();
  const now = new Date();

  const reactionPayload = {
    reactionSlug: config.reaction.slug,
    emoji: config.reaction.emoji,
    label: config.reaction.label,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      avatarColor: user.avatarColor,
    },
  };

  const messagePayload = {
    id: messageId,
    content: config.reaction.emoji,
    type: "reaction",
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
  };

  // Publish both events without awaiting — instant delivery
  publishToRoom(roomId, "reaction.sent", reactionPayload);
  publishToRoom(roomId, "message.new", messagePayload);

  // Persist reaction as a message in DB
  await prisma.message.create({
    data: {
      id: messageId,
      content: config.reaction.emoji,
      type: "reaction",
      roomId,
      userId: user.id,
      createdAt: now,
    },
  });

  return Response.json({ ok: true });
}