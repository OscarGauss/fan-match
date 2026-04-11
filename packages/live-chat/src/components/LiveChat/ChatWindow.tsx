"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, RoomRole } from "../../types";
import { MessageBubble } from "./MessageBubble";

interface ChatWindowProps {
  messages: ChatMessage[];
  currentUserId?: string;
  role?: RoomRole;
  height?: number;
  onDeleteMessage?: (messageId: string) => void;
  onBanUser?: (userId: string) => void;
}

export function ChatWindow({
  messages,
  currentUserId,
  role = "VIEWER",
  height = 500,
  onDeleteMessage,
  onBanUser,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Track if user is scrolled near the bottom
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 80;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // Auto-scroll when new messages arrive only if user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-y-auto flex flex-col gap-0.5 py-2"
      style={{ height: '100%' }}
    >
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-gray-400">No messages yet. Say hi!</p>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          currentUserId={currentUserId}
          role={role}
          onDelete={onDeleteMessage}
          onBan={onBanUser}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
