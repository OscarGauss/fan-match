import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToRoom } from "@/lib/ably-server";

// DELETE /api/rooms/[roomId]/messages/[messageId] — soft-delete (mod/owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; messageId: string }> }
) {
  const { roomId, messageId } = await params;
  const body = await request.json();
  const { walletAddress } = body as { walletAddress?: string };

  if (!walletAddress) {
    return Response.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Check caller has OWNER or MODERATOR role in this room
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });

  if (!membership || !["OWNER", "MODERATOR"].includes(membership.role)) {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.roomId !== roomId) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  // Notify clients to remove the message
  await publishToRoom(roomId, "message.deleted", { messageId });

  return new Response(null, { status: 204 });
}
