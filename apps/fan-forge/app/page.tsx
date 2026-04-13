'use client';

import { usePollar, WalletButton } from '@pollar/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchStatus = 'WAITING' | 'ACTIVE' | 'FINISHED';

const MATCH_DURATION_MS = 5 * 60 * 1000;

interface Match {
  id: string;
  name: string;
  ownerWallet: string;
  status: MatchStatus;
  startedAt: string | null;
  createdAt: string;
}

function effectiveStatus(match: Match): MatchStatus {
  if (match.status === 'FINISHED') return 'FINISHED';
  if (match.startedAt && Date.now() - new Date(match.startedAt).getTime() >= MATCH_DURATION_MS) {
    return 'FINISHED';
  }
  return match.status;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<MatchStatus, string> = {
  WAITING: 'Waiting',
  ACTIVE: 'Live',
  FINISHED: 'Finished',
};

const STATUS_COLOR: Record<MatchStatus, string> = {
  WAITING: 'var(--text-muted)',
  ACTIVE: 'var(--gold)',
  FINISHED: 'var(--text-dim)',
};

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

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
              <div
                className="h-1 flex-1 rounded-full"
                style={{ background: 'var(--border-accent)' }}
              >
                <div
                  className="h-full w-1/2 rounded-full"
                  style={{ background: accent, opacity: 0.6 }}
                />
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
  const ownerWallet = walletAddress;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ownerWallet }),
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
      <div
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-accent)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="mb-5 text-base font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          New match
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Match name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Final Round"
              required
              className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-accent)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Owner wallet
              <span className="ml-1 normal-case" style={{ color: 'var(--text-dim)' }}>
                (from Pollar)
              </span>
            </label>
            <input
              value={ownerWallet}
              placeholder="G…"
              required
              className="rounded-lg border px-3 py-2 text-sm mono outline-none focus:ring-1"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-accent)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}

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
      </div>
    </div>
  );
}

// ── MatchCard ─────────────────────────────────────────────────────────────────

function MatchCard({
  match,
  isOwner,
  onSelect,
}: {
  match: Match;
  isOwner: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="group w-full rounded-xl border p-4 text-left transition-all duration-150 hover:scale-[1.01]"
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-accent)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="truncate text-sm font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
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
          <span className="text-[11px] mono" style={{ color: 'var(--text-dim)' }}>
            {truncate(match.ownerWallet)}
          </span>
        </div>

        <span
          className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            color: STATUS_COLOR[effectiveStatus(match)],
            borderColor: STATUS_COLOR[effectiveStatus(match)],
          }}
        >
          {STATUS_LABEL[effectiveStatus(match)]}
        </span>
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
  const { openLoginModal, isAuthenticated, walletAddress } = usePollar();

  useEffect(() => {
    fetch('/api/matches')
      .then((r) => r.json())
      .then((data) => setMatches(data))
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(match: Match) {
    setSelectedMatch(match);
    setStep('teams');
  }

  function handleCreated(match: Match) {
    setMatches((prev) => [match, ...prev]);
    setShowCreate(false);
  }

  function handleNewMatch() {
    if (!isAuthenticated) {
      openLoginModal();
    } else {
      setShowCreate(true);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16"
      style={{ background: 'var(--bg-root)' }}
    >
      {/* Logo */}
      <div className="mb-4 flex items-baseline gap-0">
        <span
          className="text-6xl font-black tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Fan
        </span>
        <span className="text-6xl font-black tracking-tight" style={{ color: 'var(--red)' }}>
          Forge
        </span>
      </div>

      <p className="mb-14 text-base" style={{ color: 'var(--text-muted)' }}>
        AI plays.&nbsp;Fans forge the outcome.
      </p>

      <WalletButton />

      {/* ── Step: match selection ─────────────────────────────────────── */}
      {step === 'matches' && (
        <div className="w-full max-w-sm">
          <div className="mb-4 flex items-center justify-between">
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Select a match
            </span>
            <button
              onClick={handleNewMatch}
              className="rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-opacity hover:opacity-80"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-accent)',
              }}
            >
              + New match
            </button>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm mono" style={{ color: 'var(--text-dim)' }}>
              Loading…
            </p>
          ) : matches.length === 0 ? (
            <div
              className="flex flex-col items-center gap-4 rounded-xl border py-10"
              style={{ borderColor: 'var(--border-accent)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No matches yet.
              </p>
              <button
                onClick={handleNewMatch}
                className="rounded-lg px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80"
                style={{ background: 'var(--text-primary)', color: '#0a0a0f' }}
              >
                Create the first match
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  isOwner={!!walletAddress && m.ownerWallet === walletAddress}
                  onSelect={() => handleSelect(m)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step: team selection ──────────────────────────────────────── */}
      {step === 'teams' && selectedMatch && (
        <div className="flex w-full max-w-xl flex-col items-center gap-6">
          <div className="flex w-full items-center gap-3">
            <button
              onClick={() => setStep('matches')}
              className="text-xs mono transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              ← Back
            </button>
            <span
              className="rounded-full border px-3 py-1 text-xs font-bold tracking-wide"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border-accent)' }}
            >
              {selectedMatch.name}
            </span>
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: STATUS_COLOR[effectiveStatus(selectedMatch)],
                borderColor: STATUS_COLOR[effectiveStatus(selectedMatch)],
              }}
            >
              {STATUS_LABEL[effectiveStatus(selectedMatch)]}
            </span>
          </div>

          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
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

      {showCreate && (
        <CreateMatchModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
