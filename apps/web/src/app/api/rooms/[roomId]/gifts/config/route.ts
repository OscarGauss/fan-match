import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/rooms/[roomId]/gifts/config — full gift config for the owner panel
// Returns ALL gift types for this room (enabled and disabled), with price override if set.
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
  const allGiftTypes = await prisma.giftType.findMany();
  const existingConfigs = await prisma.roomGiftConfig.findMany({ where: { roomId } });
  const existingSlugs = new Set(existingConfigs.map((c) => c.giftSlug));
  const missing = allGiftTypes.filter((g) => !existingSlugs.has(g.slug));
  if (missing.length > 0) {
    await prisma.roomGiftConfig.createMany({
      data: missing.map((g) => ({ roomId, giftSlug: g.slug, isEnabled: true })),
      skipDuplicates: true,
    });
  }

  const configs = await prisma.roomGiftConfig.findMany({
    where: { roomId },
    include: { gift: true },
    orderBy: { gift: { sortOrder: "asc" } },
  });

  const data = configs.map((c) => ({
    giftSlug: c.giftSlug,
    emoji: c.gift.emoji,
    label: c.gift.label,
    defaultPrice: c.gift.priceAmount,
    priceAsset: c.gift.priceAsset,
    isEnabled: c.isEnabled,
    priceOverride: c.priceOverride ?? null,
  }));

  return Response.json(data);
}

// PATCH /api/rooms/[roomId]/gifts/config — update one or more gift configs
// Body: { callerWallet, configs: [{ giftSlug, isEnabled?, priceOverride? }] }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { callerWallet, configs } = body as {
    callerWallet?: string;
    configs?: { giftSlug: string; isEnabled?: boolean; priceOverride?: string | null }[];
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

  // Validate price overrides are non-negative numbers
  for (const cfg of configs) {
    if (cfg.priceOverride !== undefined && cfg.priceOverride !== null) {
      const n = parseFloat(cfg.priceOverride);
      if (isNaN(n) || n < 0) {
        return Response.json({ error: `Invalid price for ${cfg.giftSlug}` }, { status: 400 });
      }
    }
  }

  await prisma.$transaction(
    configs.map((cfg) =>
      prisma.roomGiftConfig.update({
        where: { roomId_giftSlug: { roomId, giftSlug: cfg.giftSlug } },
        data: {
          ...(cfg.isEnabled !== undefined && { isEnabled: cfg.isEnabled }),
          ...(cfg.priceOverride !== undefined && {
            priceOverride: cfg.priceOverride === null ? null : parseFloat(cfg.priceOverride).toFixed(2),
          }),
        },
      })
    )
  );

  return Response.json({ ok: true });
}
