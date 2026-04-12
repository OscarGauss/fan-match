"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { GiftDefinition } from "../../types";

interface GiftPanelProps {
  gifts: GiftDefinition[];
  onSendGift: (slug: string, quantity: number) => Promise<void>;
  disabled?: boolean;
}

const QUANTITIES = [1, 5, 10];

export function GiftPanel({ gifts, onSendGift, disabled = false }: GiftPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedQty, setSelectedQty] = useState(1);
  const [sending, setSending] = useState<string | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      bottom: window.innerHeight - rect.top + 8,
      left: Math.max(8, rect.left - 248 + rect.width),
      zIndex: 9999,
      width: 248,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (gifts.length === 0) return null;

  const handleSendGift = async (gift: GiftDefinition) => {
    if (disabled || sending) return;
    setSending(gift.slug);
    try { await onSendGift(gift.slug, selectedQty); }
    finally { setSending(null); }
  };

  const totalPrice = (gift: GiftDefinition) =>
    (parseFloat(gift.priceAmount) * selectedQty).toFixed(2);

  const panel = (
    <div
      ref={panelRef}
      style={{
        ...panelStyle,
        background: "var(--bg-panel)",
        border: "1px solid var(--border-accent)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Enviar regalo
          </p>
          <div className="flex gap-1">
            {QUANTITIES.map((q) => (
              <button
                key={q}
                onClick={() => setSelectedQty(q)}
                className="px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: selectedQty === q ? "var(--blue)" : "var(--bg-surface)",
                  color: selectedQty === q ? "#0a0a0f" : "var(--text-muted)",
                  border: "1px solid var(--border-accent)",
                }}
              >
                ×{q}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {gifts.map((gift) => (
            <button
              key={gift.slug}
              onClick={() => handleSendGift(gift)}
              disabled={!!sending}
              className="flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span className="text-2xl leading-none group-hover:scale-110 transition-transform">
                {sending === gift.slug ? "⏳" : gift.emoji}
              </span>
              <span className="text-[10px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>
                {gift.label}
              </span>
              <span className="text-[10px] font-semibold" style={{ color: "var(--blue)" }}>
                ${totalPrice(gift)} {gift.priceAsset}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed"
        style={{ color: open ? "var(--blue)" : "var(--text-muted)" }}
        onMouseEnter={(e) => {
          if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = "var(--blue)";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
        }}
        title="Regalos"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}