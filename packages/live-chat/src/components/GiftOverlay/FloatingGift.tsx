"use client";

import { useEffect, useState } from "react";
import type { GiftEvent } from "../../types";

interface FloatingGiftProps {
  gift: GiftEvent & { key: string };
  viewerWallet: string;
}

type Phase = "idle" | "rising" | "fading";

// Timings (ms)
const RISE_DELAY = 50;
const HOLD_MS = 3800;   // how long it stays fully visible before fading
const FADE_DURATION = 2200; // CSS transition for the fade-out

/**
 * Two-phase animation:
 *   idle → rising  : quick rise + full opacity
 *   rising → fading: slow fade + continues rising
 *
 * isSender gets larger emoji + scale burst on enter.
 */
export function FloatingGift({ gift, viewerWallet }: FloatingGiftProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const isSender = gift.user.walletAddress === viewerWallet;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("rising"), RISE_DELAY);
    const t2 = setTimeout(() => setPhase("fading"), RISE_DELAY + HOLD_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Random horizontal position — memoised so it doesn't shift on re-render
  const [leftPct] = useState(() => 15 + Math.random() * 70);
  const displayName = gift.user.username ?? `${gift.user.walletAddress.slice(0, 6)}…`;

  const isVisible = phase === "rising";
  const isFading  = phase === "fading";

  // ── positional state ─────────────────────────────────────────────────────
  const bottom =
    phase === "idle"   ? "2%"  :
    phase === "rising" ? "40%" :
                         "75%";

  const opacity = phase === "idle" ? 0 : isFading ? 0 : 1;

  // ── size / scale ──────────────────────────────────────────────────────────
  const emojiSize  = isSender ? "text-6xl"  : "text-4xl";
  const labelSize  = isSender ? "text-sm"   : "text-[11px]";
  const subSize    = isSender ? "text-xs"   : "text-[10px]";
  const scale =
    phase === "idle"   ? (isSender ? "scale-90"   : "scale-90")   :
    phase === "rising" ? (isSender ? "scale-[1.4]" : "scale-100") :
                         (isSender ? "scale-[1.6]" : "scale-110");

  // ── transition speeds ─────────────────────────────────────────────────────
  const riseDuration  = isSender ? "duration-[600ms]"          : "duration-[900ms]";
  const fadeDuration  = `duration-[${FADE_DURATION}ms]`;

  const transition =
    phase !== "fading"
      ? `${riseDuration} ease-out`
      : `${fadeDuration} ease-in`;

  // ── sender ring / glow ────────────────────────────────────────────────────
  const senderRing = isSender && isVisible
    ? "ring-2 ring-indigo-400/60 ring-offset-1"
    : "";

  return (
    <div
      className={`absolute flex flex-col items-center gap-1 pointer-events-none select-none transition-all ${transition}`}
      style={{ left: `${leftPct}%`, bottom, opacity, transform: `translateX(-50%)` }}
    >
      {/* Emoji */}
      <span
        className={`${emojiSize} drop-shadow-lg leading-none transition-transform ${transition} ${scale}`}
      >
        {gift.emoji}
      </span>

      {/* x quantity */}
      {gift.quantity > 1 && (
        <span className={`font-bold text-white drop-shadow leading-none ${isSender ? "text-xl" : "text-base"}`}>
          ×{gift.quantity}
        </span>
      )}

      {/* Label card */}
      <div
        className={`flex flex-col items-center rounded-xl px-2 py-0.5 ${senderRing} ${
          isSender
            ? "bg-indigo-600/70 backdrop-blur-sm"
            : "bg-black/40 backdrop-blur-sm"
        }`}
      >
        <span className={`${labelSize} text-white font-semibold leading-tight`}>
          {displayName}
        </span>
        <span className={`${subSize} text-white/80 leading-tight`}>
          {isSender ? "✨ " : ""}envió {gift.quantity > 1 ? `${gift.quantity} ` : ""}{gift.label}
        </span>
      </div>
    </div>
  );
}