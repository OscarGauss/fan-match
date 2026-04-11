import Ably from "ably";

// Singleton Ably REST client for server-side use (API routes)
let ablyClient: Ably.Rest | null = null;

export function getAblyServer(): Ably.Rest {
  if (!ablyClient) {
    const key = process.env.ABLY_API_KEY;
    if (!key) throw new Error("ABLY_API_KEY is not set");
    ablyClient = new Ably.Rest({ key });
  }
  return ablyClient;
}

/**
 * Publish a message to a room channel.
 * Best-effort: logs errors but never throws so callers don't fail.
 */
export async function publishToRoom(
  roomId: string,
  event: string,
  data: unknown
): Promise<void> {
  try {
    const ably = getAblyServer();
    const channel = ably.channels.get(`chat:${roomId}`);
    await channel.publish(event, data);
  } catch (err) {
    console.warn(`[Ably] Failed to publish "${event}" to room ${roomId}:`, err);
  }
}
