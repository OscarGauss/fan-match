"use client";

import type { ChatMessage, RoomRole } from "../../types";

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserId?: string;
  role?: RoomRole;
  onDelete?: (messageId: string) => void;
  onBan?: (userId: string) => void;
}

function getInitials(name: string | null, wallet: string): string {
  if (name) return name.slice(0, 2).toUpperCase();
  return wallet.slice(0, 2).toUpperCase();
}

export function MessageBubble({
  message,
  currentUserId,
  role = "VIEWER",
  onDelete,
  onBan,
}: MessageBubbleProps) {
  const isMod = role === "OWNER" || role === "MODERATOR";
  const isOwnMessage = message.user.id === currentUserId;
  const displayName =
    message.user.username ?? `${message.user.walletAddress.slice(0, 6)}...`;
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="group flex items-start gap-2 px-3 py-1.5 rounded-lg transition-colors"
      style={{ opacity: message.pending ? 0.6 : 1 }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={{
          backgroundColor: message.user.avatarColor,
          color: "#0a0a0f",
        }}
      >
        {getInitials(message.user.username, message.user.walletAddress)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: message.user.avatarColor }}
          >
            {displayName}
          </span>
          <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-dim)" }}>
            {time}
          </span>
        </div>
        {message.type === "reaction" ? (
          <span className="text-2xl leading-none">{message.content}</span>
        ) : (
          <p className="text-sm break-words leading-snug" style={{ color: "var(--text-primary)" }}>
            {message.content}
          </p>
        )}
      </div>

      {/* Mod actions */}
      {isMod && !isOwnMessage && (
        <div className="flex-shrink-0 hidden group-hover:flex items-center gap-1">
          {onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="p-1 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "var(--red)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
              }
              title="Delete message"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          {onBan && (
            <button
              onClick={() => onBan(message.user.id)}
              className="p-1 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "var(--red)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
              }
              title="Ban user"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}