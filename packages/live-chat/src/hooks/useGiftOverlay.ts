import { useState, useCallback } from "react";
import type { GiftEvent } from "../types";

interface ActiveGift extends GiftEvent {
  key: string; // unique render key
}

const GIFT_DISPLAY_MS = 6500;

/**
 * Manages a queue of active gift animations.
 * Each gift is added, then automatically removed after GIFT_DISPLAY_MS.
 */
export function useGiftOverlay() {
  const [activeGifts, setActiveGifts] = useState<ActiveGift[]>([]);

  const addGift = useCallback((gift: GiftEvent) => {
    const key = `${gift.id}-${Date.now()}`;
    setActiveGifts((prev) => [...prev, { ...gift, key }]);

    setTimeout(() => {
      setActiveGifts((prev) => prev.filter((g) => g.key !== key));
    }, GIFT_DISPLAY_MS);
  }, []);

  return { activeGifts, addGift };
}
