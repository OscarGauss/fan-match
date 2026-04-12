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
    <div
      className="flex items-center gap-2 px-3 py-1.5"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        style={{ color: "var(--gold)" }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--gold)" }}>
        Slow mode:
      </span>
      <div className="flex gap-1 flex-wrap">
        {SLOW_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSlowMode(opt.value)}
            disabled={saving}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: current === opt.value ? "var(--gold)" : "var(--bg-panel)",
              color: current === opt.value ? "#0a0a0f" : "var(--text-muted)",
              border: "1px solid var(--border-accent)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}