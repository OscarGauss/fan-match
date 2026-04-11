"use client";

import { useEffect, useRef } from "react";
import Ably from "ably";
import type { GiftOverlayProps, GiftEvent } from "../../types";
import { useGiftOverlay } from "../../hooks/useGiftOverlay";
import { FloatingGift } from "./FloatingGift";

/**
 * GiftOverlay — standalone component.
 *
 * Position it as a child of any `position: relative` container.
 * It will fill 100% width and height of that container via `position: absolute; inset: 0`.
 *
 * Examples:
 *   // Inside the chat — covers just the chat area
 *   <div className="relative h-full">
 *     <GiftOverlay roomId={roomId} walletAddress={wallet} />
 *     <ChatContent />
 *   </div>
 *
 *   // At root layout — covers the full page
 *   <div className="relative min-h-screen">
 *     <GiftOverlay roomId={roomId} walletAddress={wallet} />
 *     <App />
 *   </div>
 */
export function GiftOverlay({
  roomId,
  walletAddress,
  apiBaseUrl = "/api",
}: GiftOverlayProps) {
  const { activeGifts, addGift } = useGiftOverlay();
  const ablyRef = useRef<Ably.Realtime | null>(null);

  useEffect(() => {
    if (!walletAddress || !roomId) return;

    const ably = new Ably.Realtime({
      authUrl: `${apiBaseUrl}/rooms/${roomId}/ably-token`,
      authMethod: "POST",
      authHeaders: { "Content-Type": "application/json" },
      authParams: { walletAddress },
      clientId: walletAddress,
    });

    ablyRef.current = ably;

    const channel = ably.channels.get(`chat:${roomId}`);

    channel.subscribe("gift.sent", (msg) => {
      addGift(msg.data as GiftEvent);
    });

    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, [roomId, walletAddress, apiBaseUrl, addGift]);

  if (activeGifts.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none z-50"
    >
      {activeGifts.map((gift) => (
        <FloatingGift key={gift.key} gift={gift} viewerWallet={walletAddress} />
      ))}
    </div>
  );
}
