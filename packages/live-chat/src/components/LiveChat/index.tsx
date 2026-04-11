"use client";

import { useEffect, useCallback } from "react";
import type { LiveChatProps } from "../../types";
import { useLiveChat } from "../../hooks/useLiveChat";
import { useSlowMode } from "../../hooks/useSlowMode";
import { ChatWindow } from "./ChatWindow";
import { ChatInput } from "./ChatInput";
import { GiftPanel } from "./GiftPanel";
import { ModerationBar } from "./ModerationBar";

export function LiveChat({
  roomId,
  walletAddress,
  username,
  role = "VIEWER",
  apiBaseUrl = "/api",
  height = 500,
  className = "",
  onBeforeGift,
}: LiveChatProps) {
  const {
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
  } = useLiveChat({ roomId, walletAddress, apiBaseUrl, role });

  const { canSend, secondsLeft, startCooldown } = useSlowMode(slowModeSeconds);

  // Determine current user's DB id (from messages they've sent)
  const currentUserId = messages.find((m) => m.user.walletAddress === walletAddress)?.user.id;

  // Check if current user got banned
  const isBanned = bannedUserId !== null && bannedUserId === currentUserId;

  const isMod = role === "OWNER" || role === "MODERATOR";

  const handleSend = useCallback(
    async (content: string) => {
      await sendMessage(content);
      startCooldown();
    },
    [sendMessage, startCooldown]
  );

  const handleSendGift = useCallback(
    async (giftSlug: string, quantity: number) => {
      let txHash: string | undefined;

      if (onBeforeGift) {
        const gift = gifts.find((g) => g.slug === giftSlug);
        if (!gift) return;
        const result = await onBeforeGift(giftSlug, quantity, gift.priceAmount, gift.priceAsset);
        if (result === false) return; // payment cancelled or failed
        txHash = result.txHash;
      }

      await sendGift({ giftSlug, quantity, txHash });
    },
    [sendGift, onBeforeGift, gifts]
  );

  return (
    <div
      className={`flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden ${className}`}
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">Chat en vivo</span>
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-green-400" : "bg-gray-300"
            }`}
          />
        </div>
        <span className="text-xs text-gray-400">{messages.length} mensajes</span>
      </div>

      {/* Moderation bar (owner/mod only) */}
      {isMod && (
        <ModerationBar
          roomId={roomId}
          walletAddress={walletAddress}
          slowModeSeconds={slowModeSeconds}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0">
        <ChatWindow
          messages={messages}
          currentUserId={currentUserId}
          role={role}
          height={undefined} // let flex handle height
          onDeleteMessage={isMod ? deleteMessage : undefined}
          onBanUser={isMod ? banUser : undefined}
        />
      </div>

      {/* Banned notice */}
      {isBanned && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600 text-center">Has sido bloqueado de este chat.</p>
        </div>
      )}

      {/* Input area */}
      {!isBanned && (
        <div className="flex flex-col border-t border-gray-100">
          {/* Reaction quick-access bar */}
          {reactions.length > 0 && (
            <div className="flex items-center gap-0.5 px-3 pt-1.5 pb-0.5 overflow-x-auto scrollbar-none">
              {reactions.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => sendReaction(r.slug)}
                  title={r.label}
                  className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-gray-100 active:scale-90 flex items-center justify-center text-lg transition-all"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 pr-2">
            <div className="flex-1">
              <ChatInput
                onSend={handleSend}
                disabled={isBanned}
                canSend={canSend}
                secondsLeft={secondsLeft}
                onSlowModeSent={startCooldown}
              />
            </div>
            <GiftPanel
              gifts={gifts}
              onSendGift={handleSendGift}
              disabled={isBanned}
            />
          </div>
        </div>
      )}
    </div>
  );
}
