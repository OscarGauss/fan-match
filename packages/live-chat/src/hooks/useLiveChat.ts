"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Ably from "ably";
import type { ChatMessage, GiftDefinition, GiftEvent, ReactionDefinition, ReactionEvent, RoomRole } from "../types";

interface UseLiveChatOptions {
  roomId: string;
  walletAddress: string;
  apiBaseUrl?: string;
  role?: RoomRole;
}

interface SendGiftParams {
  giftSlug: string;
  quantity: number;
  txHash?: string;
}

export function useLiveChat({
  roomId,
  walletAddress,
  apiBaseUrl = "/api",
  role = "VIEWER",
}: UseLiveChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gifts, setGifts] = useState<GiftDefinition[]>([]);
  const [reactions, setReactions] = useState<ReactionDefinition[]>([]);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const [bannedUserId, setBannedUserId] = useState<string | null>(null);

  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  // ----- Ably connection -----
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

    ably.connection.on("connected", () => setConnected(true));
    ably.connection.on("disconnected", () => setConnected(false));

    const channel = ably.channels.get(`chat:${roomId}`);
    channelRef.current = channel;

    channel.subscribe("message.new", (msg) => {
      const message = msg.data as ChatMessage;
      setMessages((prev) => {
        // deduplicate
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    channel.subscribe("message.deleted", (msg) => {
      const { messageId } = msg.data as { messageId: string };
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    channel.subscribe("user.banned", (msg) => {
      const { userId } = msg.data as { userId: string };
      setBannedUserId(userId);
    });

    channel.subscribe("room.updated", (msg) => {
      const { slowModeSeconds: sms } = msg.data as { slowModeSeconds: number };
      setSlowModeSeconds(sms);
    });

    channel.subscribe("room.config_updated", (msg) => {
      const { updated } = msg.data as { updated: "gifts" | "reactions" };
      if (updated === "gifts" || updated === "reactions") {
        const path = updated === "gifts" ? "gifts" : "reactions";
        fetch(`${apiBaseUrl}/rooms/${roomId}/${path}`)
          .then((r) => r.json())
          .then((data) => {
            if (updated === "gifts") setGifts(data);
            else setReactions(data);
          })
          .catch(console.error);
      }
    });

    return () => {
      channel.unsubscribe();
      ably.close();
      setConnected(false);
    };
  }, [roomId, walletAddress, apiBaseUrl]);

  // ----- Load initial messages -----
  useEffect(() => {
    if (!roomId) return;

    fetch(`${apiBaseUrl}/rooms/${roomId}/messages`)
      .then((r) => r.json())
      .then((data: ChatMessage[]) => setMessages(data))
      .catch(console.error);
  }, [roomId, apiBaseUrl]);

  // ----- Load gift config -----
  useEffect(() => {
    if (!roomId) return;

    fetch(`${apiBaseUrl}/rooms/${roomId}/gifts`)
      .then((r) => r.json())
      .then((data: GiftDefinition[]) => setGifts(data))
      .catch(console.error);
  }, [roomId, apiBaseUrl]);

  // ----- Load reaction config -----
  useEffect(() => {
    if (!roomId) return;

    fetch(`${apiBaseUrl}/rooms/${roomId}/reactions`)
      .then((r) => r.json())
      .then((data: ReactionDefinition[]) => setReactions(data))
      .catch(console.error);
  }, [roomId, apiBaseUrl]);

  // ----- Load room slow mode -----
  useEffect(() => {
    if (!roomId) return;

    fetch(`${apiBaseUrl}/rooms/${roomId}`)
      .then((r) => r.json())
      .then((data: { slowModeSeconds: number }) => setSlowModeSeconds(data.slowModeSeconds ?? 0))
      .catch(console.error);
  }, [roomId, apiBaseUrl]);

  // ----- Actions -----
  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      await fetch(`${apiBaseUrl}/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, walletAddress }),
      });
    },
    [apiBaseUrl, roomId, walletAddress]
  );

  const sendGift = useCallback(
    async ({ giftSlug, quantity, txHash }: SendGiftParams): Promise<void> => {
      await fetch(`${apiBaseUrl}/rooms/${roomId}/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, giftSlug, quantity, txHash }),
      });
    },
    [apiBaseUrl, roomId, walletAddress]
  );

  const deleteMessage = useCallback(
    async (messageId: string): Promise<void> => {
      await fetch(`${apiBaseUrl}/rooms/${roomId}/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
    },
    [apiBaseUrl, roomId, walletAddress]
  );

  const banUser = useCallback(
    async (targetUserId: string): Promise<void> => {
      await fetch(`${apiBaseUrl}/rooms/${roomId}/bans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerWallet: walletAddress, targetUserId }),
      });
    },
    [apiBaseUrl, roomId, walletAddress]
  );

  const sendReaction = useCallback(
    async (reactionSlug: string): Promise<void> => {
      await fetch(`${apiBaseUrl}/rooms/${roomId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, reactionSlug }),
      });
    },
    [apiBaseUrl, roomId, walletAddress]
  );

  const subscribeToGifts = useCallback(
    (handler: (gift: GiftEvent) => void) => {
      const channel = channelRef.current;
      if (!channel) return () => {};
      channel.subscribe("gift.sent", (msg) => handler(msg.data as GiftEvent));
      return () => channel.unsubscribe("gift.sent");
    },
    []
  );

  const subscribeToReactions = useCallback(
    (handler: (reaction: ReactionEvent) => void) => {
      const channel = channelRef.current;
      if (!channel) return () => {};
      channel.subscribe("reaction.sent", (msg) => handler(msg.data as ReactionEvent));
      return () => channel.unsubscribe("reaction.sent");
    },
    []
  );

  return {
    messages,
    gifts,
    reactions,
    slowModeSeconds,
    connected,
    bannedUserId,
    sendMessage,
    sendGift,
    sendReaction,
    deleteMessage,
    banUser,
    subscribeToGifts,
    subscribeToReactions,
  };
}
