'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentState, AgentStats, DecisionLogEntry, Team } from '@/lib/types';
import { STAT_LABELS } from '@/lib/constants';
import type { FocusedRole } from '@/lib/hooks/useMatchFocus';
import RadarChart from './RadarChart';

// ── Props ─────────────────────────────────────────────────────────────────────

export type AgentView = 'agents' | 'support';

export interface AgentPanelProps {
  agents: { red: AgentState; blue: AgentState };
  userTeam: Team;
  isGridEvent: boolean;
  activeView: AgentView;
  onViewChange: (v: AgentView) => void;
  onFundAgent: (team: Team, amountUsdc: number) => void;
  walletAddress: string | undefined;
  getClient: () => unknown;
  agentPublicKey: string;
  onLogEntries: (entries: DecisionLogEntry[]) => void;
  matchStarted?: boolean;
  needsFunds?: boolean;
  focusedRole?: FocusedRole;
  onFocusRole?: (role: keyof AgentStats) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUND_AMOUNTS = [0.05, 0.1, 0.25] as const;
const FUND_SLIDER_MIN = 0.05;
const FUND_SLIDER_MAX = 5.0;
const FUND_SLIDER_STP = 0.05;
const COMPACT_ORDER: (keyof AgentStats)[] = [
  'goalkeeper',
  'defense',
  'midfield',
  'forward',
  'speed',
];
const MONO: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' };

function teamColor(t: Team) {
  return t === 'red' ? 'var(--red)' : 'var(--blue)';
}
function teamBorder(t: Team) {
  return t === 'red' ? 'var(--red-border)' : 'var(--blue-border)';
}
function teamColorRaw(t: Team) {
  return t === 'red' ? '#ff4d4d' : '#4d9fff';
}

function truncateAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 5)}...${addr.slice(-3)}`;
}

// ── Fund slider ───────────────────────────────────────────────────────────────

function FundSlider({
  value,
  colorRaw,
  onChange,
}: {
  value: number;
  colorRaw: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - FUND_SLIDER_MIN) / (FUND_SLIDER_MAX - FUND_SLIDER_MIN)) * 100;
  return (
    <div className="relative flex items-center" style={{ height: 24 }}>
      <div
        className="w-full rounded-full"
        style={{ height: 3, background: 'var(--bg-surface)', position: 'relative' }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${pct}%`,
            background: colorRaw,
            borderRadius: 'inherit',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: `calc(${pct}% - 7px)`,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: colorRaw,
          border: '2px solid var(--bg-panel)',
          boxShadow: `0 0 0 2px ${colorRaw}44, 0 2px 4px rgba(0,0,0,0.4)`,
          pointerEvents: 'none',
        }}
      />
      <input
        type="range"
        min={FUND_SLIDER_MIN}
        max={FUND_SLIDER_MAX}
        step={FUND_SLIDER_STP}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          margin: 0,
        }}
      />
    </div>
  );
}

// ── Fund section ──────────────────────────────────────────────────────────────

const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
type TxState = 'idle' | 'connecting' | 'sending' | 'confirming' | 'done' | 'error';

function FundSection({
  team,
  onFund,
  walletAddress,
  getClient,
  agentPublicKey,
  onLogEntries,
  onTxDone,
}: {
  team: Team;
  onFund: (amount: number) => void;
  walletAddress: string | undefined;
  getClient: () => unknown;
  agentPublicKey: string;
  onLogEntries: (entries: DecisionLogEntry[]) => void;
  onTxDone?: () => void;
}) {
  const [value, setValue] = useState(0.1);
  const [txState, setTxState] = useState<TxState>('idle');

  const color = teamColor(team);
  const colorRaw = teamColorRaw(team);
  const activePill = FUND_AMOUNTS.find((a) => Math.abs(a - value) < 0.001) ?? null;

  async function handleConfirm() {
    if (!walletAddress) {
      setTxState('connecting');
      setTimeout(() => setTxState('idle'), 2000);
      return;
    }

    try {
      setTxState('sending');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (getClient as () => any)();
      await client.buildTx('payment', {
        destination: agentPublicKey,
        amount: value.toFixed(7),
        asset: { type: 'credit_alphanum4', code: 'USDC', issuer: USDC_ISSUER_TESTNET },
      });
      const built = client.getTransactionState();
      if (!built || built.step !== 'built') throw new Error('build failed');
      await client.signAndSubmitTx(built.buildData.unsignedXdr);
      const final = client.getTransactionState();
      if (!final || final.step !== 'success') throw new Error('tx failed');
      const txHash: string = final.hash;

      setTxState('confirming');

      const res = await fetch('/api/agent/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: team, txHash, amount: value, fanAddress: walletAddress }),
      });
      const data = await res.json();

      setTxState('done');
      onFund(value);
      onLogEntries(data.logEntries ?? []);
      onTxDone?.();
      setTimeout(() => setTxState('idle'), 1500);
    } catch {
      setTxState('error');
      setTimeout(() => setTxState('idle'), 2000);
    }
  }

  return (
    <div style={{ paddingBottom: 2 }}>
      {/* Pills */}
      <div className="flex gap-1.5 mb-2">
        {FUND_AMOUNTS.map((a) => {
          const active = activePill === a;
          return (
            <button
              key={a}
              onClick={() => setValue(a)}
              className="flex-1 rounded py-0.5 text-[10px] transition-all"
              style={{
                ...MONO,
                border: `1px solid ${active ? color : 'var(--border-accent)'}`,
                background: active ? `${colorRaw}22` : 'transparent',
                color: active ? color : 'var(--text-muted)',
              }}
            >
              {a.toFixed(2)}
            </button>
          );
        })}
      </div>

      {/* Slider + value */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1">
          <FundSlider value={value} colorRaw={colorRaw} onChange={setValue} />
        </div>
        <motion.span
          key={value.toFixed(2)}
          initial={{ opacity: 0.5, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.1 }}
          className="w-8 text-right text-[10px] font-bold tabular-nums"
          style={{ ...MONO, color }}
        >
          {value.toFixed(2)}
        </motion.span>
      </div>

      {/* CTA — outlined, no fill */}
      <AnimatePresence mode="wait">
        {txState !== 'idle' ? (
          <motion.div
            key={txState}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded py-1.5 text-center text-[10px] font-bold uppercase tracking-wider"
            style={{
              background:
                txState === 'done'
                  ? '#00ff8818'
                  : txState === 'error'
                    ? '#ff4d4d18'
                    : `${colorRaw}18`,
              color:
                txState === 'done'
                  ? '#00ff88'
                  : txState === 'error'
                    ? '#ff4d4d'
                    : 'var(--text-muted)',
              border:
                txState === 'done'
                  ? '1px solid #00ff8855'
                  : txState === 'error'
                    ? '1px solid #ff4d4d55'
                    : '1px solid var(--border-accent)',
            }}
          >
            {txState === 'connecting' && 'connect wallet first'}
            {txState === 'sending' && 'sending...'}
            {txState === 'confirming' && 'confirming...'}
            {txState === 'done' && 'funded! ✓'}
            {txState === 'error' && 'tx failed'}
          </motion.div>
        ) : (
          <motion.button
            key="btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleConfirm}
            className="w-full rounded py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{ background: color, border: 'none', color: '#0a0a0f', cursor: 'pointer' }}
          >
            Fund {team === 'red' ? 'AgentRed' : 'AgentBlue'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Support chart (Polymarket-style) ─────────────────────────────────────────

function SupportChart({ redUsdc, blueUsdc }: { redUsdc: number; blueUsdc: number }) {
  const [history, setHistory] = useState<number[]>([0.5]);
  const lastSampleRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastSampleRef.current < 2500) return;
    lastSampleRef.current = now;
    const total = redUsdc + blueUsdc;
    const share = total === 0 ? 0.5 : redUsdc / total;
    const id = setTimeout(() => {
      setHistory((prev) => {
        if (Math.abs(prev[prev.length - 1] - share) < 0.003 && prev.length > 1) return prev;
        return [...prev.slice(-79), share];
      });
    }, 0);
    return () => clearTimeout(id);
  }, [redUsdc, blueUsdc]);

  const total = redUsdc + blueUsdc;
  const redPct = total === 0 ? 50 : Math.round((redUsdc / total) * 100);
  const bluePct = 100 - redPct;
  const current = history[history.length - 1];

  const W = 200,
    H = 100;

  const pts = history.map((v, i) => ({
    x: history.length === 1 ? 0 : (i / (history.length - 1)) * W,
    y: H * (1 - v),
  }));
  const edge = [{ x: 0, y: pts[0].y }, ...pts, { x: W, y: pts[pts.length - 1].y }];
  const linePath = edge
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const redFill = `${linePath} L${W},${H} L0,${H} Z`;
  const bluFill = `${linePath} L${W},0 L0,0 Z`;

  // Current dot position (right edge)
  const dotY = H * (1 - current);

  return (
    <div className="flex flex-1 flex-col gap-1.5 min-h-0">
      {/* Percentage labels */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold" style={{ ...MONO, color: 'var(--red)' }}>
          Red {redPct}%
        </span>
        <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          fan support
        </span>
        <span className="text-[11px] font-bold" style={{ ...MONO, color: 'var(--blue)' }}>
          Blue {bluePct}%
        </span>
      </div>

      {/* Chart — fills remaining space */}
      <div
        className="flex-1 min-h-0"
        style={{
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg-surface)',
          position: 'relative',
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4d4d" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ff4d4d" stopOpacity="0.32" />
            </linearGradient>
            <linearGradient id="bluGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4d9fff" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#4d9fff" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          {/* Fills */}
          <path d={bluFill} fill="url(#bluGrad)" />
          <path d={redFill} fill="url(#redGrad)" />
          {/* 50% reference line */}
          <line
            x1={0}
            y1={H / 2}
            x2={W}
            y2={H / 2}
            stroke="#ffffff20"
            strokeWidth={0.8}
            strokeDasharray="4 4"
          />
          {/* Data line */}
          <path
            d={linePath}
            fill="none"
            stroke="#ffffff55"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Live dot */}
          <circle cx={W} cy={dotY} r={3} fill={current >= 0.5 ? '#ff4d4d' : '#4d9fff'} />
          <circle cx={W} cy={dotY} r={6} fill={current >= 0.5 ? '#ff4d4d22' : '#4d9fff22'} />
        </svg>
      </div>
    </div>
  );
}

// ── Support bar ───────────────────────────────────────────────────────────────

function SupportBar({ redUsdc, blueUsdc }: { redUsdc: number; blueUsdc: number }) {
  const total = redUsdc + blueUsdc;
  const redFrac = total === 0 ? 0.5 : redUsdc / total;
  const blueFrac = total === 0 ? 0.5 : blueUsdc / total;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative flex h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--bg-surface)' }}
      >
        <motion.div
          className="h-full"
          style={{ background: 'var(--red)' }}
          animate={{ width: `${redFrac * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full flex-1"
          style={{ background: 'var(--blue)' }}
          animate={{ width: `${blueFrac * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px"
          style={{ background: 'rgba(255,255,255,0.25)' }}
        />
      </div>
      <div className="flex justify-between">
        <span className="text-[10px]" style={{ ...MONO, color: 'var(--red)' }}>
          {redUsdc.toFixed(2)} USDC
        </span>
        <span className="text-[10px]" style={{ ...MONO, color: 'var(--blue)' }}>
          {blueUsdc.toFixed(2)} USDC
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentPanel({
  agents,
  userTeam,
  isGridEvent,
  activeView,
  onViewChange,
  onFundAgent,
  walletAddress,
  getClient,
  agentPublicKey,
  onLogEntries,
  matchStarted = false,
  needsFunds = false,
  focusedRole = null,
  onFocusRole,
}: AgentPanelProps) {
  const agent = agents[userTeam];
  const color = teamColor(userTeam);
  const agentName = userTeam === 'red' ? 'AgentRed' : 'AgentBlue';

  // ── Live on-chain USDC balance ────────────────────────────────────────────
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [balanceFetching, setBalanceFetching] = useState(false);
  const fetchBalanceFnRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    if (!userTeam) return;
    let cancelled = false;

    async function fetchBalance() {
      setBalanceFetching(true);
      try {
        const res = await fetch(`/api/agent/balance?agentId=${userTeam}`);
        const data = await res.json();
        if (!cancelled) setLiveBalance(data.balance ?? null);
      } catch {
        // leave previous value
      } finally {
        if (!cancelled) setBalanceFetching(false);
      }
    }

    fetchBalanceFnRef.current = fetchBalance;
    fetchBalance();
    const id = setInterval(fetchBalance, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userTeam]);

  // Track previous stats for upgrade flashing
  const prevStatsRef = useRef<AgentStats>({ ...agent.stats });
  const [prevStats, setPrevStats] = useState<AgentStats>({ ...agent.stats });
  const [flashingStats, setFlashingStats] = useState<Set<keyof AgentStats>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cur = agent.stats;
    const prev = prevStatsRef.current;
    if (!COMPACT_ORDER.some((k) => cur[k] !== prev[k])) return;
    const fresh = new Set<keyof AgentStats>();
    for (const k of COMPACT_ORDER) {
      if (cur[k] > prev[k]) fresh.add(k);
    }
    if (fresh.size > 0) {
      setFlashingStats(fresh);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashingStats(new Set()), 1500);
    }
    setPrevStats({ ...prev });
    prevStatsRef.current = { ...cur };
  }, [agent.stats]);

  useEffect(() => {
    setFlashingStats(new Set());
    prevStatsRef.current = { ...agents[userTeam].stats };
    setPrevStats({ ...agents[userTeam].stats });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTeam]);

  const TAB_ORDER: AgentView[] = ['agents', 'support'];

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--bg-panel)' }}>
      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="flex shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        {TAB_ORDER.map((v) => {
          const active = activeView === v;
          const label =
            v === 'support' ? (userTeam === 'red' ? 'Support Red' : 'Support Blue') : 'Agents';
          return (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className="relative flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors"
              style={{
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
              }}
            >
              {label}
              {active && (
                <span
                  className="absolute inset-x-0 bottom-0 h-[2px]"
                  style={{ background: 'var(--text-muted)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content (no scroll) ───────────────────────────────────────── */}
      {activeView === 'agents' && (
        <div className="flex flex-1 flex-col overflow-hidden p-2.5 gap-2">
          {/* Identity */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold" style={{ ...MONO, color }}>
                {agentName}
              </span>
              {agentPublicKey ? (
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${agentPublicKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] transition-opacity hover:opacity-100"
                  style={{ ...MONO, color: 'var(--text-muted)', opacity: 0.7, textDecoration: 'none' }}
                >
                  {truncateAddr(agentPublicKey)} ↗
                </a>
              ) : (
                <span className="text-[10px]" style={{ ...MONO, color: 'var(--text-muted)' }}>
                  —
                </span>
              )}
            </div>
            <motion.div
              key={liveBalance ?? agent.usdcReceived}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col items-end"
            >
              <span className="flex items-center gap-1.5 text-base font-bold leading-none" style={{ ...MONO, color }}>
                {balanceFetching && (
                  <span
                    className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2"
                    style={{ borderColor: color, borderTopColor: 'transparent' }}
                  />
                )}
                {liveBalance !== null ? liveBalance.toFixed(2) : agent.usdcReceived.toFixed(2)}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                USDC
              </span>
            </motion.div>
          </div>

          {/* Radar */}
          <RadarChart stats={agent.stats} team={userTeam} prevStats={prevStats} maxHeight={165} />

          {/* Compact stat row — clickable, highlights focused role */}
          <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
            {COMPACT_ORDER.map((key, idx) => {
              const isFlashing = flashingStats.has(key);
              const isFocused = focusedRole === key;
              const isAnyFocused = focusedRole !== null;
              const dimmed = isAnyFocused && !isFocused;
              return (
                <span key={key} className="flex items-center gap-1">
                  {idx > 0 && (
                    <span style={{ ...MONO, color: 'var(--text-dim)', fontSize: 9 }}>·</span>
                  )}
                  <motion.button
                    onClick={() => onFocusRole?.(key)}
                    style={{
                      ...MONO,
                      fontSize: 9,
                      background: isFocused ? `${teamColorRaw(userTeam)}22` : 'transparent',
                      border: isFocused ? `1px solid ${teamColorRaw(userTeam)}66` : '1px solid transparent',
                      borderRadius: 3,
                      padding: '1px 4px',
                      cursor: onFocusRole ? 'pointer' : 'default',
                      color: isFlashing
                        ? color
                        : isFocused
                          ? color
                          : dimmed
                            ? 'var(--text-dim)'
                            : 'var(--text-muted)',
                    }}
                    animate={{
                      color: isFlashing
                        ? color
                        : isFocused
                          ? teamColorRaw(userTeam)
                          : dimmed
                            ? '#33333a'
                            : 'var(--text-muted)',
                    }}
                    transition={{ duration: isFlashing ? 0 : 0.2 }}
                  >
                    {STAT_LABELS[key]} · {agent.stats[key]}
                  </motion.button>
                </span>
              );
            })}
          </div>

          {/* Boost badge */}
          {agent.activeBoost && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5 rounded border px-2 py-1"
              style={{ borderColor: teamBorder(userTeam), background: `${color}11` }}
            >
              <span className="text-[10px] font-bold" style={{ color }}>
                ⚡ boost active ×1.5
              </span>
            </motion.div>
          )}

          {/* Needs funds alert */}
          <AnimatePresence>
            {needsFunds && matchStarted && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 rounded border px-2 py-1.5"
                style={{
                  borderColor: `${teamColorRaw(userTeam)}55`,
                  background: `${teamColorRaw(userTeam)}0f`,
                }}
              >
                {/* pulsing dot */}
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ background: teamColorRaw(userTeam) }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ background: teamColorRaw(userTeam) }}
                  />
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ ...MONO, color: teamColor(userTeam) }}
                >
                  {agentName} needs USDC to upgrade
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fund section — enabled only after match starts */}
          {matchStarted ? (
            <FundSection
              team={userTeam}
              onFund={(amount) => onFundAgent(userTeam, amount)}
              walletAddress={walletAddress}
              getClient={getClient}
              agentPublicKey={agentPublicKey}
              onLogEntries={onLogEntries}
              onTxDone={() => fetchBalanceFnRef.current?.()}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg py-4 text-[11px] tracking-widest uppercase"
              style={{
                fontFamily: 'var(--font-space-mono)',
                background: 'var(--bg-surface)',
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
              }}
            >
              waiting for match to start…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
