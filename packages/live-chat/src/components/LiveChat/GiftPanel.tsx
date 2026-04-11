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

  // Recalculate position whenever panel opens
  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      bottom: window.innerHeight - rect.top + 8,
      left: Math.max(8, rect.left - 288 + rect.width), // keep within viewport
      zIndex: 9999,
      width: 288,
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideButton = buttonRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideButton && !insidePanel) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (gifts.length === 0) return null;

  const handleSend = async (gift: GiftDefinition) => {
    if (disabled || sending) return;
    setSending(gift.slug);
    try {
      await onSendGift(gift.slug, selectedQty);
    } finally {
      setSending(null);
    }
  };

  const totalPrice = (gift: GiftDefinition) =>
    (parseFloat(gift.priceAmount) * selectedQty).toFixed(2);

  const panel = (
    <div
      ref={panelRef}
      style={panelStyle}
      className="bg-white border border-gray-100 rounded-2xl shadow-lg p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600">Enviar regalo</p>
        <div className="flex gap-1">
          {QUANTITIES.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQty(q)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                selectedQty === q
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              x{q}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {gifts.map((gift) => (
          <button
            key={gift.slug}
            onClick={() => handleSend(gift)}
            disabled={!!sending}
            className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
          >
            <span className="text-2xl leading-none group-hover:scale-110 transition-transform">
              {sending === gift.slug ? "⏳" : gift.emoji}
            </span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight">{gift.label}</span>
            <span className="text-[10px] text-indigo-500 font-semibold">
              ${totalPrice(gift)} {gift.priceAsset}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex-shrink-0 w-8 h-8 text-gray-400 hover:text-indigo-500 disabled:text-gray-200 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
        title="Enviar un regalo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}