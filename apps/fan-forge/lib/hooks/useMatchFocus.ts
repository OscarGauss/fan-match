'use client';

import { useState, useCallback } from 'react';
import type { AgentStats } from '@/lib/types';

export type FocusedRole = keyof AgentStats | null;

export interface UseMatchFocusReturn {
  focusedRole: FocusedRole;
  setFocusedRole: (role: FocusedRole) => void;
  /** Toggle: clicking the same role unfocuses, clicking a different one focuses it. */
  toggleRole: (role: keyof AgentStats) => void;
}

/**
 * Tracks which role (GK · DEF · MID · FWD · SPD) is currently highlighted.
 * The canvas and stat row both react to this value.
 *
 * Mocked with null by default — wire to real match state as needed.
 */
export function useMatchFocus(): UseMatchFocusReturn {
  const [focusedRole, setFocusedRole] = useState<FocusedRole>(null);

  const toggleRole = useCallback((role: keyof AgentStats) => {
    setFocusedRole((prev) => (prev === role ? null : role));
  }, []);

  return { focusedRole, setFocusedRole, toggleRole };
}
