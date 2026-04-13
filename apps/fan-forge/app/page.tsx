'use client';

import { usePollar, WalletButton } from '@pollar/react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchStatus = 'WAITING' | 'ACTIVE' | 'FINISHED';
type Tab = 'live' | 'waiting' | 'history';

const MATCH_DURATION_MS = 5 * 60 * 1000;

interface Match {
  id: string;
  name: string;
  ownerWallet: string;
  status: MatchStatus;
  startedAt: string | null;
  createdAt: string;
  scoreRed: number;
  scoreBlue: number;
}

function effectiveStatus(match: Match): MatchStatus {
  if (match.status === 'FINISHED') return 'FINISHED';
  if (match.startedAt && Date.now() - new Date(match.startedAt).getTime() >= MATCH_DURATION_MS) {
    return 'FINISHED';
  }
  return match.status;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' };

// ── TeamCard ──────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  label,
  accent,
  dimBg,
  border,
  matchId,
  ownerWallet,
}: {
  team: string;
  label: string;
  accent: string;
  dimBg: string;
  border: string;
  matchId: string;
  ownerWallet: string;
}) {
  return (
    <Link
      href={`/game?matchId=${matchId}&team=${team === 'AgentRed' ? 'red' : 'blue'}&ownerWallet=${ownerWallet}`}
      className="group flex-1 min-w-[220px] max-w-[300px]"
    >
      <div
        className="flex flex-col gap-5 rounded-xl border p-6 transition-all duration-200 group-hover:scale-[1.02]"
        style={{ background: dimBg, borderColor: border }}
      >
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
            {label}
          </span>
        </div>

        <div>
          <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {team}
          </p>
          <p className="mt-1 text-xs mono" style={{ color: 'var(--text-muted)' }}>
            Agent online · base stats
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {['GK', 'DEF', 'MID', 'FWD'].map((role) => (
            <div key={role} className="flex items-center gap-2">
              <span className="w-8 text-[10px] mono" style={{ color: 'var(--text-dim)' }}>
                {role}
              </span>
              <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--border-accent)' }}>
                <div className="h-full w-1/2 rounded-full" style={{ background: accent, opacity: 0.6 }} />
              </div>
            </div>
          ))}
        </div>

        <button
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-bold tracking-wide transition-opacity duration-150 hover:opacity-90"
          style={{ background: accent, color: '#0a0a0f' }}
        >
          Join team
        </button>
      </div>
    </Link>
  );
}

// ── CreateMatchModal ──────────────────────────────────────────────────────────

function CreateMatchModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (match: Match) => void;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { walletAddress } = usePollar();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ownerWallet: walletAddress }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong');
        return;
      }
      const match: Match = await res.json();
      onCreated(match);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-accent)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-5 text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          New match
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Match name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Final Round"
              required
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-accent)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Owner wallet
              <span className="ml-1 normal-case" style={{ color: 'var(--text-dim)' }}>(from Pollar)</span>
            </label>
            <input
              value={walletAddress}
              readOnly
              placeholder="G…"
              className="rounded-lg border px-3 py-2 text-sm outline-none opacity-60"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-accent)',
                color: 'var(--text-primary)',
                ...MONO,
              }}
            />
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border py-2.5 text-sm font-bold transition-opacity hover:opacity-70"
              style={{ borderColor: 'var(--border-accent)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: 'var(--text-primary)', color: '#0a0a0f' }}
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── HistoryModal ──────────────────────────────────────────────────────────────

function HistoryModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const winner =
    match.scoreRed > match.scoreBlue ? 'red' :
    match.scoreBlue > match.scoreRed ? 'blue' : 'tie';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 12 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-6 rounded-2xl border p-10"
        style={{
          ...MONO,
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-accent)',
          minWidth: 320,
          boxShadow: '0 0 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Match name */}
        <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
          {match.name}
        </div>

        {/* Score */}
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl font-bold" style={{ color: 'var(--red)' }}>{match.scoreRed}</span>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--red)', opacity: 0.7 }}>Red</span>
          </div>
          <span className="text-3xl font-bold" style={{ color: 'var(--text-dim)' }}>:</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl font-bold" style={{ color: 'var(--blue)' }}>{match.scoreBlue}</span>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--blue)', opacity: 0.7 }}>Blue</span>
          </div>
        </div>

        {/* Winner badge */}
        <div
          className="px-4 py-1.5 rounded text-[11px] font-bold uppercase tracking-widest"
          style={{
            background: winner === 'tie' ? '#ffffff0a' : winner === 'red' ? 'rgba(255,60,80,0.15)' : 'rgba(77,159,255,0.15)',
            color: winner === 'tie' ? 'var(--text-muted)' : winner === 'red' ? 'var(--red)' : 'var(--blue)',
            border: `1px solid ${winner === 'tie' ? 'var(--border)' : winner === 'red' ? 'rgba(255,60,80,0.35)' : 'rgba(77,159,255,0.35)'}`,
          }}
        >
          {winner === 'tie' ? 'Draw' : `${winner === 'red' ? 'Red' : 'Blue'} won`}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-lg py-2.5 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
          style={{ border: '1px solid var(--border-accent)', color: 'var(--text-muted)' }}
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}

// ── LiveMatchCard ─────────────────────────────────────────────────────────────

function LiveMatchCard({ match, isOwner, onSelect }: { match: Match; isOwner: boolean; onSelect: () => void }) {
  const elapsed = match.startedAt ? Date.now() - new Date(match.startedAt).getTime() : 0;
  const rem = Math.max(0, MATCH_DURATION_MS - elapsed);
  const s = Math.ceil(rem / 1000);
  const timer = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <button
      onClick={onSelect}
      className="group w-full rounded-xl border p-4 text-left transition-all duration-150 hover:scale-[1.01]"
      style={{ background: 'var(--bg-panel)', borderColor: 'rgba(0,255,136,0.2)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Live pulse */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#00ff88' }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#00ff88' }} />
            </span>
            <span className="truncate text-sm font-bold" style={{ color: 'var(--text-primary)', ...MONO }}>
              {match.name}
            </span>
            {isOwner && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                you
              </span>
            )}
          </div>
          <span className="text-[11px]" style={{ color: 'var(--text-dim)', ...MONO }}>
            {truncate(match.ownerWallet)}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Score */}
          <div className="flex items-center gap-1.5 text-sm font-bold" style={MONO}>
            <span style={{ color: 'var(--red)' }}>{match.scoreRed}</span>
            <span style={{ color: 'var(--text-dim)' }}>:</span>
            <span style={{ color: 'var(--blue)' }}>{match.scoreBlue}</span>
          </div>
          {/* Timer */}
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ ...MONO, background: 'rgba(0,255,136,0.08)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.2)' }}>
            {timer}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── WaitingMatchCard ──────────────────────────────────────────────────────────

function WaitingMatchCard({ match, isOwner, onSelect }: { match: Match; isOwner: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="group w-full rounded-xl border p-4 text-left transition-all duration-150 hover:scale-[1.01]"
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-accent)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm font-bold" style={{ color: 'var(--text-primary)', ...MONO }}>
              {match.name}
            </span>
            {isOwner && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                you
              </span>
            )}
          </div>
          <span className="text-[11px]" style={{ color: 'var(--text-dim)', ...MONO }}>
            {truncate(match.ownerWallet)}
          </span>
        </div>
        <span
          className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border-accent)', ...MONO }}
        >
          Waiting
        </span>
      </div>
    </button>
  );
}

// ── HistoryMatchCard ──────────────────────────────────────────────────────────

function HistoryMatchCard({ match, isOwner, onSelect }: { match: Match; isOwner: boolean; onSelect: () => void }) {
  const winner =
    match.scoreRed > match.scoreBlue ? 'red' :
    match.scoreBlue > match.scoreRed ? 'blue' : 'tie';

  return (
    <button
      onClick={onSelect}
      className="group w-full rounded-xl border p-4 text-left transition-all duration-150 hover:scale-[1.01]"
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-accent)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm font-bold" style={{ color: 'var(--text-muted)', ...MONO }}>
              {match.name}
            </span>
            {isOwner && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                you
              </span>
            )}
          </div>
          <span className="text-[11px]" style={{ color: 'var(--text-dim)', ...MONO }}>
            {truncate(match.ownerWallet)}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Final score */}
          <div className="flex items-center gap-1.5 text-sm font-bold" style={MONO}>
            <span style={{ color: winner === 'red' ? 'var(--red)' : 'var(--text-dim)' }}>{match.scoreRed}</span>
            <span style={{ color: 'var(--text-dim)' }}>:</span>
            <span style={{ color: winner === 'blue' ? 'var(--blue)' : 'var(--text-dim)' }}>{match.scoreBlue}</span>
          </div>
          <span
            className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-dim)', borderColor: '#333', ...MONO }}
          >
            Final
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LobbyPage() {
  const [step, setStep] = useState<'matches' | 'teams'>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [historyMatch, setHistoryMatch] = useState<Match | null>(null);
  const [tab, setTab] = useState<Tab>('live');
  const { openLoginModal, isAuthenticated, walletAddress } = usePollar();

  useEffect(() => {
    fetch('/api/matches')
      .then((r) => r.json())
      .then((data) => setMatches(data))
      .finally(() => setLoading(false));
  }, []);

  const liveMatches = matches.filter((m) => effectiveStatus(m) === 'ACTIVE');
  const waitingMatches = matches.filter((m) => effectiveStatus(m) === 'WAITING');
  const finishedMatches = matches.filter((m) => effectiveStatus(m) === 'FINISHED');

  // Auto-select best tab
  useEffect(() => {
    if (!loading) {
      if (liveMatches.length > 0) setTab('live');
      else if (waitingMatches.length > 0) setTab('waiting');
      else setTab('history');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function handleSelect(match: Match) {
    setSelectedMatch(match);
    setStep('teams');
  }

  function handleCreated(match: Match) {
    setMatches((prev) => [match, ...prev]);
    setShowCreate(false);
    setTab('waiting');
  }

  function handleNewMatch() {
    if (!isAuthenticated) openLoginModal();
    else setShowCreate(true);
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'live', label: 'Live', count: liveMatches.length },
    { key: 'waiting', label: 'Waiting', count: waitingMatches.length },
    { key: 'history', label: 'History', count: finishedMatches.length },
  ];

  const TAB_ACCENT: Record<Tab, string> = {
    live: '#00ff88',
    waiting: 'var(--text-muted)',
    history: 'var(--text-dim)',
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center px-6 py-16"
      style={{ background: 'var(--bg-root)' }}
    >
      {/* Logo */}
      <div className="mb-3 flex items-baseline gap-0">
        <span className="text-6xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Fan</span>
        <span className="text-6xl font-black tracking-tight" style={{ color: 'var(--red)' }}>Forge</span>
      </div>

      <p className="mb-10 text-base" style={{ color: 'var(--text-muted)' }}>
        AI plays.&nbsp;Fans forge the outcome.
      </p>

      <div className="mb-10">
        <WalletButton />
      </div>

      {/* ── Step: match selection ─────────────────────────────────────── */}
      {step === 'matches' && (
        <div className="w-full max-w-md">

          {/* Header row */}
          <div className="mb-5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Select a match
            </span>
            <button
              onClick={handleNewMatch}
              className="rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-opacity hover:opacity-80"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-accent)', ...MONO }}
            >
              + New match
            </button>
          </div>

          {/* Tabs */}
          <div
            className="mb-4 flex rounded-lg overflow-hidden"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-accent)' }}
          >
            {TABS.map(({ key, label, count }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    ...MONO,
                    background: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? TAB_ACCENT[key] : 'var(--text-dim)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {key === 'live' && active && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#00ff88' }} />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: '#00ff88' }} />
                    </span>
                  )}
                  {label}
                  {count > 0 && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px]"
                      style={{
                        background: active ? (key === 'live' ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.05)',
                        color: active ? TAB_ACCENT[key] : 'var(--text-dim)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading ? (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--text-dim)', ...MONO }}>
              Loading…
            </p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {tab === 'live' && (
                  liveMatches.length === 0 ? (
                    <Empty label="No live matches right now" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {liveMatches.map((m) => (
                        <LiveMatchCard
                          key={m.id}
                          match={m}
                          isOwner={!!walletAddress && m.ownerWallet === walletAddress}
                          onSelect={() => handleSelect(m)}
                        />
                      ))}
                    </div>
                  )
                )}

                {tab === 'waiting' && (
                  waitingMatches.length === 0 ? (
                    <Empty label="No matches waiting to start">
                      <button
                        onClick={handleNewMatch}
                        className="rounded-lg px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80"
                        style={{ background: 'var(--text-primary)', color: '#0a0a0f' }}
                      >
                        Create a match
                      </button>
                    </Empty>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {waitingMatches.map((m) => (
                        <WaitingMatchCard
                          key={m.id}
                          match={m}
                          isOwner={!!walletAddress && m.ownerWallet === walletAddress}
                          onSelect={() => handleSelect(m)}
                        />
                      ))}
                    </div>
                  )
                )}

                {tab === 'history' && (
                  finishedMatches.length === 0 ? (
                    <Empty label="No finished matches yet" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {finishedMatches.map((m) => (
                        <HistoryMatchCard
                          key={m.id}
                          match={m}
                          isOwner={!!walletAddress && m.ownerWallet === walletAddress}
                          onSelect={() => setHistoryMatch(m)}
                        />
                      ))}
                    </div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      {/* ── Step: team selection ──────────────────────────────────────── */}
      {step === 'teams' && selectedMatch && (
        <div className="flex w-full max-w-xl flex-col items-center gap-6">
          <div className="flex w-full items-center gap-3">
            <button
              onClick={() => setStep('matches')}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)', ...MONO }}
            >
              ← Back
            </button>
            <span
              className="rounded-full border px-3 py-1 text-xs font-bold tracking-wide"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border-accent)', ...MONO }}
            >
              {selectedMatch.name}
            </span>
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: effectiveStatus(selectedMatch) === 'ACTIVE' ? '#00ff88' : 'var(--text-muted)',
                borderColor: effectiveStatus(selectedMatch) === 'ACTIVE' ? 'rgba(0,255,136,0.4)' : 'var(--border-accent)',
                ...MONO,
              }}
            >
              {effectiveStatus(selectedMatch) === 'ACTIVE' ? 'Live' : effectiveStatus(selectedMatch) === 'WAITING' ? 'Waiting' : 'Finished'}
            </span>
          </div>

          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            Choose your team
          </p>

          <div className="flex w-full flex-wrap justify-center gap-4">
            <TeamCard
              team="AgentRed"
              label="Team Red"
              accent="var(--red)"
              dimBg="var(--red-dim)"
              border="var(--red-border)"
              matchId={selectedMatch.id}
              ownerWallet={selectedMatch.ownerWallet}
            />
            <TeamCard
              team="AgentBlue"
              label="Team Blue"
              accent="var(--blue)"
              dimBg="var(--blue-dim)"
              border="var(--blue-border)"
              matchId={selectedMatch.id}
              ownerWallet={selectedMatch.ownerWallet}
            />
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <CreateMatchModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyMatch && (
          <HistoryModal match={historyMatch} onClose={() => setHistoryMatch(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border py-10"
      style={{ borderColor: 'var(--border-accent)' }}
    >
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {children}
    </div>
  );
}
