"use client";

import { useEffect, useRef } from "react";
import Ably from "ably";
import type { GiftOverlayProps, GiftEvent, ReactionEvent } from "../../types";
import { useGiftOverlay } from "../../hooks/useGiftOverlay";
import { FloatingGift } from "./FloatingGift";

export function GiftOverlay({
  roomId,
  walletAddress,
  apiBaseUrl = "/api",
}: GiftOverlayProps) {
  const { items, addGift, addReaction } = useGiftOverlay();
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

    channel.subscribe("gift.sent",     (msg) => addGift(msg.data as GiftEvent));
    channel.subscribe("reaction.sent", (msg) => addReaction(msg.data as ReactionEvent));

    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, [roomId, walletAddress, apiBaseUrl, addGift, addReaction]);

  if (items.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none z-50"
    >
      {items.map((item) => (
        <FloatingGift key={item.key} item={item} viewerWallet={walletAddress} />
      ))}
    </div>
  );
}
