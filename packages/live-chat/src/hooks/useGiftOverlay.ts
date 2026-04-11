import { useState, useCallback } from "react";
import type { GiftEvent, ReactionEvent } from "../types";

export interface OverlayItem {
  key: string;
  type: "gift" | "reaction";
  emoji: string;
  label: string;
  /** Only meaningful for gifts */
  quantity: number;
  user: GiftEvent["user"];
  /** Show sender label card — false for burst duplicates */
  showLabel: boolean;
}

const GIFT_DISPLAY_MS    = 6500;
const REACTION_DISPLAY_MS = 4000;
/** Max simultaneous burst animations for a single gift event */
const MAX_BURST = 5;
/** Delay between each burst animation */
const BURST_INTERVAL_MS = 180;

export function useGiftOverlay() {
  const [items, setItems] = useState<OverlayItem[]>([]);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const addGift = useCallback(
    (gift: GiftEvent) => {
      const burst = Math.min(gift.quantity, MAX_BURST);

      for (let i = 0; i < burst; i++) {
        const key = `gift-${gift.id}-${i}-${Date.now()}`;
        const delay = i * BURST_INTERVAL_MS;

        setTimeout(() => {
          setItems((prev) => [
            ...prev,
            {
              key,
              type: "gift",
              emoji: gift.emoji,
              label: gift.label,
              quantity: gift.quantity,
              user: gift.user,
              showLabel: i === 0, // only first burst shows the label card
            },
          ]);
          setTimeout(() => removeItem(key), GIFT_DISPLAY_MS);
        }, delay);
      }
    },
    [removeItem]
  );

  const addReaction = useCallback(
    (reaction: ReactionEvent) => {
      const key = `reaction-${reaction.reactionSlug}-${Date.now()}`;
      setItems((prev) => [
        ...prev,
        {
          key,
          type: "reaction",
          emoji: reaction.emoji,
          label: reaction.label,
          quantity: 1,
          user: reaction.user,
          showLabel: true,
        },
      ]);
      setTimeout(() => removeItem(key), REACTION_DISPLAY_MS);
    },
    [removeItem]
  );

  return { items, addGift, addReaction };
}
