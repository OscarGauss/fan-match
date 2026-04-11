import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToRoom } from "@/lib/ably-server";
import { verifyGiftPayment } from "@/lib/stellar";

// GET /api/rooms/[roomId]/gifts — get active gift config for room
// Auto-creates configs for any catalog items the room is missing (default: enabled).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const [allGiftTypes, existingConfigs] = await Promise.all([
    prisma.giftType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.roomGiftConfig.findMany({ where: { roomId } }),
  ]);

  const existingSlugs = new Set(existingConfigs.map((c) => c.giftSlug));
  const missing = allGiftTypes.filter((g) => !existingSlugs.has(g.slug));

  if (missing.length > 0) {
    await prisma.roomGiftConfig.createMany({
      data: missing.map((g) => ({ roomId, giftSlug: g.slug, isEnabled: true })),
      skipDuplicates: true,
    });
  }

  const configs = await prisma.roomGiftConfig.findMany({
    where: { roomId, isEnabled: true },
    include: { gift: true },
    orderBy: { gift: { sortOrder: "asc" } },
  });

  const gifts = configs.map((c) => ({
    slug: c.giftSlug,
    emoji: c.gift.emoji,
    label: c.gift.label,
    priceAmount: c.priceOverride ?? c.gift.priceAmount,
    priceAsset: c.gift.priceAsset,
  }));

  return Response.json(gifts);
}

// POST /api/rooms/[roomId]/gifts — send a gift
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { walletAddress, giftSlug, quantity, txHash } = body as {
    walletAddress?: string;
    giftSlug?: string;
    quantity?: number;
    txHash?: string;
  };

  if (!walletAddress || !giftSlug) {
    return Response.json({ error: "walletAddress and giftSlug are required" }, { status: 400 });
  }

  const qty = Math.max(1, Math.min(100, quantity ?? 1));

  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Check if user is banned
  const ban = await prisma.ban.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (ban) return Response.json({ error: "You are banned from this room" }, { status: 403 });

  // Validate gift config for this room
  const config = await prisma.roomGiftConfig.findUnique({
    where: { roomId_giftSlug: { roomId, giftSlug } },
    include: { gift: true },
  });

  if (!config || !config.isEnabled) {
    return Response.json({ error: "Gift not available in this room" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });

  // Determine effective price
  const priceAmount = config.priceOverride ?? config.gift.priceAmount;
  const priceAsset = config.gift.priceAsset;
  const totalAmount = (parseFloat(priceAmount) * qty).toFixed(2);

  // Determine recipient wallet: room config > owner wallet
  let recipientWallet = room.recipientWallet;
  if (!recipientWallet) {
    const ownerMember = await prisma.roomMember.findFirst({
      where: { roomId, role: "OWNER" },
      include: { user: true },
    });
    recipientWallet = ownerMember?.user.walletAddress ?? null;
  }

  // Verify payment on Stellar (skip if price is 0 or no tx hash)
  if (parseFloat(priceAmount) > 0 && recipientWallet) {
    if (!txHash) {
      return Response.json({ error: "txHash is required for paid gifts" }, { status: 400 });
    }

    const { valid, reason } = await verifyGiftPayment({
      txHash,
      expectedTo: recipientWallet,
      expectedAmount: totalAmount,
      expectedAsset: priceAsset,
    });

    if (!valid) {
      return Response.json({ error: `Payment verification failed: ${reason}` }, { status: 402 });
    }
  }

  const giftEvent = await prisma.giftEvent.create({
    data: { roomId, userId: user.id, giftSlug, quantity: qty, txHash: txHash ?? null },
    include: {
      user: { select: { id: true, username: true, walletAddress: true, avatarColor: true } },
      gift: true,
    },
  });

  // Publish to Ably
  await publishToRoom(roomId, "gift.sent", {
    id: giftEvent.id,
    giftSlug,
    emoji: config.gift.emoji,
    label: config.gift.label,
    quantity: qty,
    user: giftEvent.user,
    createdAt: giftEvent.createdAt,
  });

  return Response.json(giftEvent, { status: 201 });
}
