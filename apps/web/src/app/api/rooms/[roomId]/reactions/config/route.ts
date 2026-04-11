import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToRoom } from "@/lib/ably-server";

// GET /api/rooms/[roomId]/reactions/config — full reaction config for the owner panel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const callerWallet = request.nextUrl.searchParams.get("callerWallet");

  if (!callerWallet) {
    return Response.json({ error: "callerWallet is required" }, { status: 400 });
  }

  const caller = await prisma.user.findUnique({ where: { walletAddress: callerWallet } });
  if (!caller) return Response.json({ error: "User not found" }, { status: 404 });

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: caller.id } },
  });
  if (!membership || membership.role !== "OWNER") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Auto-create missing configs for any new catalog items
  const allReactionTypes = await prisma.reactionType.findMany();
  const existingConfigs = await prisma.roomReactionConfig.findMany({ where: { roomId } });
  const existingSlugs = new Set(existingConfigs.map((c) => c.reactionSlug));
  const missing = allReactionTypes.filter((r) => !existingSlugs.has(r.slug));
  if (missing.length > 0) {
    await prisma.roomReactionConfig.createMany({
      data: missing.map((r) => ({ roomId, reactionSlug: r.slug, isEnabled: true })),
      skipDuplicates: true,
    });
  }

  const configs = await prisma.roomReactionConfig.findMany({
    where: { roomId },
    include: { reaction: true },
    orderBy: { reaction: { sortOrder: "asc" } },
  });

  const data = configs.map((c) => ({
    reactionSlug: c.reactionSlug,
    emoji: c.reaction.emoji,
    label: c.reaction.label,
    isEnabled: c.isEnabled,
  }));

  return Response.json(data);
}

// PATCH /api/rooms/[roomId]/reactions/config — toggle reactions on/off
// Body: { callerWallet, configs: [{ reactionSlug, isEnabled }] }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { callerWallet, configs } = body as {
    callerWallet?: string;
    configs?: { reactionSlug: string; isEnabled: boolean }[];
  };

  if (!callerWallet || !configs?.length) {
    return Response.json({ error: "callerWallet and configs are required" }, { status: 400 });
  }

  const caller = await prisma.user.findUnique({ where: { walletAddress: callerWallet } });
  if (!caller) return Response.json({ error: "User not found" }, { status: 404 });

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: caller.id } },
  });
  if (!membership || membership.role !== "OWNER") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(
    configs.map((cfg) =>
      prisma.roomReactionConfig.update({
        where: { roomId_reactionSlug: { roomId, reactionSlug: cfg.reactionSlug } },
        data: { isEnabled: cfg.isEnabled },
      })
    )
  );

  await publishToRoom(roomId, "room.config_updated", { updated: "reactions" });

  return Response.json({ ok: true });
}
