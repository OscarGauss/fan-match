import { useState, useEffect, useCallback } from "react";

/**
 * Manages slow-mode countdown between messages.
 * Returns { canSend, secondsLeft, startCooldown }.
 */
export function useSlowMode(slowModeSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  const startCooldown = useCallback(() => {
    if (slowModeSeconds > 0) {
      setSecondsLeft(slowModeSeconds);
    }
  }, [slowModeSeconds]);

  return {
    canSend: secondsLeft === 0,
    secondsLeft,
    startCooldown,
  };
}
