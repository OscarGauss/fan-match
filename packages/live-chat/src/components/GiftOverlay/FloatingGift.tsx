"use client";

import { useEffect, useState } from "react";
import type { OverlayItem } from "../../hooks/useGiftOverlay";

interface FloatingGiftProps {
  item: OverlayItem;
  viewerWallet: string;
}

type Phase = "idle" | "rising" | "fading";

const RISE_DELAY_MS  = 50;
const GIFT_HOLD_MS   = 3800;
const REACTION_HOLD_MS = 2200;
const FADE_MS        = 2000;

export function FloatingGift({ item, viewerWallet }: FloatingGiftProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const isReaction = item.type === "reaction";
  const isSender   = item.user.walletAddress === viewerWallet;
  const holdMs     = isReaction ? REACTION_HOLD_MS : GIFT_HOLD_MS;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("rising"), RISE_DELAY_MS);
    const t2 = setTimeout(() => setPhase("fading"),  RISE_DELAY_MS + holdMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [holdMs]);

  // Random horizontal position — wider spread for reactions
  const [leftPct] = useState(() =>
    isReaction ? 5 + Math.random() * 90 : 10 + Math.random() * 80
  );
  // Reaction: random peak height between 45-75%, keeps rising while fading
  const [reactionPeak] = useState(() => 45 + Math.random() * 30);
  const reactionFinal = reactionPeak + 12;

  const displayName = item.user.username ?? `${item.user.walletAddress.slice(0, 6)}…`;

  const opacity = phase === "idle" ? 0 : phase === "fading" ? 0 : 1;

  // Reactions: rise from off-screen bottom, large emoji, random spread
  if (isReaction) {
    const bottom =
      phase === "idle"   ? "-10%"
      : phase === "rising" ? `${reactionPeak}%`
      :                      `${reactionFinal}%`;

    const scaleVal =
      phase === "idle"   ? "scale(0.4)"
      : phase === "rising" ? "scale(1)"
      :                      "scale(1.15)";

    const transitionVal =
      phase === "idle"
        ? "none"
        : phase === "rising"
        ? "bottom 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 250ms ease, transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)"
        : `bottom ${FADE_MS}ms ease-in, opacity ${FADE_MS}ms ease-in, transform ${FADE_MS}ms ease-in`;

    return (
      <div
        className="absolute flex flex-col items-center gap-1 pointer-events-none select-none"
        style={{
          left: `${leftPct}%`,
          bottom,
          opacity,
          transform: `translateX(-50%) ${scaleVal}`,
          transition: transitionVal,
        }}
      >
        <span className="text-6xl drop-shadow-lg leading-none">
          {item.emoji}
        </span>
        {item.showLabel && (
          <span className="text-[10px] text-white/80 font-semibold drop-shadow">
            {isSender ? "Tú" : displayName}
          </span>
        )}
      </div>
    );
  }

  // Gifts
  const giftBottom =
    phase === "idle"   ? "2%"  :
    phase === "rising" ? "40%" :
                         "70%";

  const emojiSize = isSender ? "text-6xl" : "text-4xl";
  const scale =
    phase === "idle"   ? "scale-90"     :
    phase === "rising" ? (isSender ? "scale-[1.3]" : "scale-100") :
                         (isSender ? "scale-[1.5]" : "scale-110");

  return (
    <div
      className="absolute flex flex-col items-center gap-1 pointer-events-none select-none transition-all ease-out"
      style={{
        left: `${leftPct}%`,
        bottom: giftBottom,
        opacity,
        transform: "translateX(-50%)",
        transitionDuration: phase === "fading" ? `${FADE_MS}ms` : "700ms",
      }}
    >
      <span className={`${emojiSize} drop-shadow-lg leading-none transition-transform duration-700 ${scale}`}>
        {item.emoji}
      </span>

      {item.showLabel && (
        <>
          {item.quantity > 1 && (
            <span className={`font-bold text-white drop-shadow leading-none ${isSender ? "text-xl" : "text-base"}`}>
              ×{item.quantity}
            </span>
          )}
          <div
            className={`flex flex-col items-center rounded-xl px-2 py-0.5 ${
              isSender
                ? "bg-indigo-600/70 backdrop-blur-sm ring-2 ring-indigo-400/50"
                : "bg-black/40 backdrop-blur-sm"
            }`}
          >
            <span className={`${isSender ? "text-sm" : "text-[11px]"} text-white font-semibold leading-tight`}>
              {isSender ? "✨ Tú" : displayName}
            </span>
            <span className={`${isSender ? "text-xs" : "text-[10px]"} text-white/80 leading-tight`}>
              envió {item.quantity > 1 ? `${item.quantity} ` : ""}{item.label}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
