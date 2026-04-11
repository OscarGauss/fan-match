import { NextRequest } from "next/server";
import Ably from "ably";

// POST /api/rooms/[roomId]/ably-token — issue a token for the client
// We use token auth so the ABLY_API_KEY is never exposed client-side.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  // Ably sends authParams as URL-encoded form data when authMethod is POST
  const text = await request.text();
  const form = new URLSearchParams(text);
  const walletAddress = form.get("walletAddress") ?? request.nextUrl.searchParams.get("walletAddress") ?? undefined;

  if (!walletAddress || walletAddress === "undefined") {
    return Response.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const key = process.env.ABLY_API_KEY;
  if (!key) {
    return Response.json({ error: "Ably not configured" }, { status: 500 });
  }

  const ably = new Ably.Rest({ key });

  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: walletAddress,
    capability: {
      // Client can subscribe to the room channel but cannot publish directly
      // (publishing goes through API routes for validation)
      [`chat:${roomId}`]: ["subscribe", "history"],
    },
  });

  return Response.json(tokenRequest);
}
