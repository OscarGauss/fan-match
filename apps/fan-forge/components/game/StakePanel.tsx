'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MatchState, Team } from '@/lib/types'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StakePanelProps {
  stakingOpen:  boolean
  stakedAmount: number | null
  stakedTeam:   Team | null
  matchStatus:  MatchState['status']
  score:        { red: number; blue: number }
  onStake:      (team: Team, amountUsdc: number) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAKE_AMOUNTS = [0.10, 0.25, 0.50] as const
const MONO: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' }

function tc(t: Team) { return t === 'red' ? 'var(--red)' : 'var(--blue)' }
function tb(t: Team) { return t === 'red' ? 'var(--red-border)' : 'var(--blue-border)' }

// ── CSS-only lock icon ────────────────────────────────────────────────────────

function LockIcon({ color }: { color: string }) {
  return (
    <span className="relative inline-flex flex-col items-center" style={{ width: 10, height: 13 }}>
      {/* Shackle */}
      <span style={{
        position:    'absolute',
        top:         0,
        left:        1,
        width:       8,
        height:      6,
        borderTop:   `1.5px solid ${color}`,
        borderLeft:  `1.5px solid ${color}`,
        borderRight: `1.5px solid ${color}`,
        borderRadius: '4px 4px 0 0',
      }} />
      {/* Body */}
      <span style={{
        position:     'absolute',
        bottom:       0,
        left:         0,
        width:        10,
        height:       7,
        background:   color,
        borderRadius: 2,
      }} />
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StakePanel({
  stakingOpen,
  stakedAmount,
  stakedTeam,
  matchStatus,
  score,
  onStake,
}: StakePanelProps) {
  const [amount,    setAmount]    = useState<(typeof STAKE_AMOUNTS)[number] | null>(null)
  const [team,      setTeam]      = useState<Team>('red')
  const [confirmed, setConfirmed] = useState(false)

  function handleStake() {
    if (!amount) return
    onStake(team, amount)
    setConfirmed(true)
    setTimeout(() => setConfirmed(false), 1800)
    setAmount(null)
  }

  const isFinished = matchStatus === 'finished'

  // ── Finished state ────────────────────────────────────────────────────────
  if (isFinished && stakedAmount !== null && stakedTeam !== null) {
    const winner = score.red > score.blue ? 'red' : score.blue > score.red ? 'blue' : null
    const won    = winner === stakedTeam

    return (
      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
        {won ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
              you won!
            </span>
            <span className="text-xl font-bold" style={{ ...MONO, color: 'var(--gold)' }}>
              +{(stakedAmount * 1.5).toFixed(2)} USDC
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              paid automatically via Soroban
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>match over</span>
            <span
              className="text-sm font-bold"
              style={{ ...MONO, color: 'var(--red)', textDecoration: 'line-through', opacity: 0.6 }}
            >
              {stakedAmount.toFixed(2)} USDC on {stakedTeam}
            </span>
          </div>
        )}
      </div>
    )
  }

  // ── Already staked ────────────────────────────────────────────────────────
  if (stakedAmount !== null && stakedTeam !== null) {
    const payout = (stakedAmount * 1.5).toFixed(2)
    const color  = tc(stakedTeam)

    return (
      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
        <div className="flex items-center gap-2">
          <LockIcon color={color} />
          <span className="text-xs font-bold" style={{ ...MONO, color }}>
            staked {stakedAmount.toFixed(2)} USDC on {stakedTeam}
          </span>
        </div>
        <p className="mt-1.5 text-[10px]" style={{ color: 'var(--gold)' }}>
          payout on win: ~{payout} USDC
        </p>
      </div>
    )
  }

  // ── Staking closed, no stake placed ──────────────────────────────────────
  if (!stakingOpen) {
    return (
      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>staking closed</p>
        <p className="text-[10px]" style={{ ...MONO, color: 'var(--text-dim)' }}>opened until 2:30</p>
      </div>
    )
  }

  // ── Staking open ──────────────────────────────────────────────────────────
  return (
    <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          stake on the match
        </span>
        <span className="text-[10px]" style={{ ...MONO, color: 'var(--text-dim)' }}>
          closes 2:30
        </span>
      </div>

      <div className="mt-2.5 flex flex-col gap-2">
        {/* Amount pills */}
        <div className="flex gap-1.5">
          {STAKE_AMOUNTS.map(a => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              className="flex-1 rounded py-0.5 text-[10px] transition-all"
              style={{
                ...MONO,
                border:     `1px solid ${amount === a ? tc(team) : 'var(--border-accent)'}`,
                background: amount === a ? `${tc(team)}22` : 'transparent',
                color:      amount === a ? tc(team) : 'var(--text-muted)',
              }}
            >
              {a.toFixed(2)}
            </button>
          ))}
        </div>

        {/* Team selector */}
        <div className="flex gap-1.5">
          {(['red', 'blue'] as Team[]).map(t => (
            <button
              key={t}
              onClick={() => setTeam(t)}
              className="flex-1 rounded py-1 text-[10px] font-bold transition-all"
              style={{
                border:     `1px solid ${team === t ? tc(t) : 'var(--border-accent)'}`,
                background: team === t ? `${tc(t)}22` : 'transparent',
                color:      team === t ? tc(t) : 'var(--text-muted)',
              }}
            >
              {t === 'red' ? '🔴' : '🔵'} {t}
            </button>
          ))}
        </div>

        {/* Confirm */}
        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded py-1.5 text-center text-xs font-bold"
              style={{ background: `${tc(team)}22`, color: tc(team), border: `1px solid ${tb(team)}` }}
            >
              staked!
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleStake}
              disabled={!amount}
              className="w-full rounded py-1.5 text-xs font-bold uppercase tracking-wider transition-all"
              style={{
                border:     amount ? 'none' : '1px solid var(--border)',
                background: amount ? tc(team) : 'transparent',
                color:      amount ? '#0a0a0f' : 'var(--text-dim)',
                cursor:     amount ? 'pointer' : 'not-allowed',
              }}
            >
              {amount ? `stake ${amount.toFixed(2)} on ${team}` : 'stake'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
