"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { GiftDefinition, ReactionDefinition } from "../../types";

interface GiftPanelProps {
  gifts: GiftDefinition[];
  reactions: ReactionDefinition[];
  onSendGift: (slug: string, quantity: number) => Promise<void>;
  onSendReaction: (slug: string) => Promise<void>;
  disabled?: boolean;
}

const QUANTITIES = [1, 5, 10];
type Tab = "gifts" | "reactions";

export function GiftPanel({
  gifts,
  reactions,
  onSendGift,
  onSendReaction,
  disabled = false,
}: GiftPanelProps) {
  const [open, setOpen]               = useState(false);
  const [tab, setTab]                 = useState<Tab>("gifts");
  const [selectedQty, setSelectedQty] = useState(1);
  const [sending, setSending]         = useState<string | null>(null);
  const [panelStyle, setPanelStyle]   = useState<React.CSSProperties>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  // Reposition panel when it opens
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      bottom: window.innerHeight - rect.top + 8,
      left: Math.max(8, rect.left - 288 + rect.width),
      zIndex: 9999,
      width: 288,
    });
  }, [open]);

  // Close on outside click
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

  if (gifts.length === 0 && reactions.length === 0) return null;

  const handleSendGift = async (gift: GiftDefinition) => {
    if (disabled || sending) return;
    setSending(gift.slug);
    try { await onSendGift(gift.slug, selectedQty); }
    finally { setSending(null); }
  };

  const handleSendReaction = async (reaction: ReactionDefinition) => {
    if (disabled || sending) return;
    setSending(reaction.slug);
    try { await onSendReaction(reaction.slug); }
    finally { setSending(null); }
  };

  const totalPrice = (gift: GiftDefinition) =>
    (parseFloat(gift.priceAmount) * selectedQty).toFixed(2);

  const panel = (
    <div ref={panelRef} style={panelStyle} className="bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab("gifts")}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            tab === "gifts"
              ? "text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          🎁 Regalos
        </button>
        <button
          onClick={() => setTab("reactions")}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            tab === "reactions"
              ? "text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          ⚡ Reacciones
        </button>
      </div>

      <div className="p-3">
        {tab === "gifts" && (
          <>
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
          </>
        )}

        {tab === "reactions" && (
          <>
            <p className="text-xs font-semibold text-gray-600 mb-2">Reaccionar — gratis</p>
            <div className="grid grid-cols-4 gap-1.5">
              {reactions.map((reaction) => (
                <button
                  key={reaction.slug}
                  onClick={() => handleSendReaction(reaction)}
                  disabled={!!sending}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                >
                  <span className="text-2xl leading-none group-hover:scale-125 transition-transform">
                    {sending === reaction.slug ? "⏳" : reaction.emoji}
                  </span>
                  <span className="text-[9px] text-gray-400 leading-tight">{reaction.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
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
        title="Regalos y reacciones"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}
