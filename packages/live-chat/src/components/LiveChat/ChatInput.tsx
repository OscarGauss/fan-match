"use client";

import { useState, useRef } from "react";

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  slowModeSeconds?: number;
  canSend?: boolean;
  secondsLeft?: number;
  onSlowModeSent?: () => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  canSend = true,
  secondsLeft = 0,
  onSlowModeSent,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled || !canSend) return;
    setValue("");
    onSlowModeSent?.();
    inputRef.current?.focus();
    setSending(true);
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isBlocked = disabled || !canSend || sending;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{ background: "var(--bg-panel)" }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isBlocked}
        maxLength={500}
        placeholder={
          !canSend && secondsLeft > 0
            ? `Slow mode — espera ${secondsLeft}s`
            : disabled
            ? "No puedes enviar mensajes"
            : "Escribe un mensaje…"
        }
        className="flex-1 text-sm rounded-full px-4 py-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-accent)",
          color: "var(--text-primary)",
          outline: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = "1px solid var(--blue)";
          e.currentTarget.style.boxShadow = "0 0 0 2px var(--blue-border)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = "1px solid var(--border-accent)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      <button
        onClick={handleSend}
        disabled={isBlocked || !value.trim()}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed"
        style={{
          background: isBlocked || !value.trim() ? "var(--bg-surface)" : "var(--blue)",
        }}
      >
        {sending ? (
          <svg className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            style={{ color: isBlocked || !value.trim() ? "var(--text-dim)" : "#0a0a0f" }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}