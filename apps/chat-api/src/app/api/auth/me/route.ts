import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/auth/me?wallet=G...
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return Response.json({ error: "Missing wallet parameter" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { walletAddress: wallet } });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(user);
}

// POST /api/auth/me — upsert user by wallet address
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { walletAddress, username, avatarColor } = body as {
    walletAddress?: string;
    username?: string;
    avatarColor?: string;
  };

  if (!walletAddress) {
    return Response.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { walletAddress },
    update: {
      ...(username !== undefined && { username }),
      ...(avatarColor !== undefined && { avatarColor }),
    },
    create: {
      walletAddress,
      username: username ?? null,
      avatarColor: avatarColor ?? "#6366f1",
    },
  });

  return Response.json(user);
}
