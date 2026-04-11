"use client";

import { useState } from "react";

interface ModerationBarProps {
  roomId: string;
  walletAddress: string;
  slowModeSeconds: number;
  apiBaseUrl?: string;
}

const SLOW_MODE_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "3s", value: 3 },
  { label: "5s", value: 5 },
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
];

export function ModerationBar({
  roomId,
  walletAddress,
  slowModeSeconds,
  apiBaseUrl = "/api",
}: ModerationBarProps) {
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(slowModeSeconds);

  const handleSlowMode = async (seconds: number) => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, slowModeSeconds: seconds }),
      });
      if (res.ok) setCurrent(seconds);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-100">
      <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span className="text-[11px] font-medium text-amber-700 flex-shrink-0">Slow mode:</span>
      <div className="flex gap-1 flex-wrap">
        {SLOW_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSlowMode(opt.value)}
            disabled={saving}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              current === opt.value
                ? "bg-amber-500 text-white"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            } disabled:opacity-50`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
