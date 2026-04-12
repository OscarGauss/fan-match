'use client';

import { useCallback } from 'react';
import { useLiveChat } from '../../hooks/useLiveChat';
import { useSlowMode } from '../../hooks/useSlowMode';
import type { LiveChatProps } from '../../types';
import { ChatInput } from './ChatInput';
import { ChatWindow } from './ChatWindow';
import { GiftPanel } from './GiftPanel';
import { ModerationBar } from './ModerationBar';

export function LiveChat({
  roomId,
  walletAddress,
  username,
  role = 'VIEWER',
  apiBaseUrl = '/api',
  height = 500,
  className = '',
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

  const currentUserId = messages.find((m) => m.user.walletAddress === walletAddress)?.user.id;
  const isBanned = bannedUserId !== null && bannedUserId === currentUserId;
  const isMod = role === 'OWNER' || role === 'MODERATOR';

  const handleSend = useCallback(
    async (content: string) => {
      await sendMessage(content);
      startCooldown();
    },
    [sendMessage, startCooldown],
  );

  const handleSendGift = useCallback(
    async (giftSlug: string, quantity: number) => {
      let txHash: string | undefined;
      if (onBeforeGift) {
        const gift = gifts.find((g) => g.slug === giftSlug);
        if (!gift) return;
        const result = await onBeforeGift(giftSlug, quantity, gift.priceAmount, gift.priceAsset);
        if (result === false) return;
        txHash = result.txHash;
      }
      await sendGift({ giftSlug, quantity, txHash });
    },
    [sendGift, onBeforeGift, gifts],
  );

  return (
    <div
      className={`flex flex-col overflow-hidden ${className}`}
      style={{
        height,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 0,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Live chat
          </span>
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: connected ? '#00ff88' : 'var(--text-dim)' }}
          />
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {messages.length} msgs
        </span>
      </div>

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
          height={undefined}
          onDeleteMessage={isMod ? deleteMessage : undefined}
          onBanUser={isMod ? banUser : undefined}
        />
      </div>

      {/* Banned notice */}
      {isBanned && (
        <div
          className="px-4 py-2"
          style={{
            borderTop: '1px solid var(--red-border)',
            background: 'var(--red-dim)',
          }}
        >
          <p className="text-xs text-center" style={{ color: 'var(--red)' }}>
            Has sido bloqueado de este chat.
          </p>
        </div>
      )}

      {/* Input area */}
      {!isBanned && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {reactions.length > 0 && (
            <div className="flex items-center gap-0.5 px-3 pt-1.5 pb-0.5 overflow-x-auto">
              {reactions.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => sendReaction(r.slug)}
                  title={r.label}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all active:scale-90"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
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
            <GiftPanel gifts={gifts} onSendGift={handleSendGift} disabled={isBanned} />
          </div>
        </div>
      )}
    </div>
  );
}