'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MatchState, Team } from '@/lib/types'
import { STAKING_CLOSE_MS } from '@/lib/constants'
import type { FeedEntry } from '@/components/game/MatchCanvas'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StakePanelProps {
  userTeam:     Team
  elapsedMs:    number
  stakingOpen:  boolean
  stakedAmount: number | null
  stakedTeam:   Team | null
  matchStatus:  MatchState['status']
  score:        { red: number; blue: number }
  feedEntries:  FeedEntry[]
  onStake:      (team: Team, amountUsdc: number) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAKE_AMOUNTS  = [0.10, 0.25, 0.50] as const
const SLIDER_MIN     = 0.10
const SLIDER_MAX     = 10.00
const SLIDER_STEP    = 0.05
const MONO: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' }

function tc(t: Team)    { return t === 'red' ? 'var(--red)' : 'var(--blue)' }
function tcRaw(t: Team) { return t === 'red' ? '#ff4d4d'    : '#4d9fff'    }

function formatCountdown(elapsedMs: number) {
  const rem = Math.max(0, STAKING_CLOSE_MS - elapsedMs)
  const s   = Math.ceil(rem / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Custom slider ─────────────────────────────────────────────────────────────

function StakeSlider({
  value,
  colorRaw,
  onChange,
}: {
  value:    number
  colorRaw: string
  onChange: (v: number) => void
}) {
  const pct = ((value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100

  return (
    <div className="relative flex items-center" style={{ height: 24 }}>
      <div className="w-full rounded-full"
        style={{ height: 3, background: 'var(--bg-surface)', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`, background: colorRaw, borderRadius: 'inherit',
        }} />
      </div>
      <div style={{
        position:     'absolute',
        left:         `calc(${pct}% - 7px)`,
        width:        14,
        height:       14,
        borderRadius: '50%',
        background:   colorRaw,
        border:       '2px solid var(--bg-panel)',
        boxShadow:    `0 0 0 2px ${colorRaw}44, 0 2px 4px rgba(0,0,0,0.4)`,
        pointerEvents:'none',
      }} />
      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          opacity: 0, cursor: 'pointer', margin: 0,
        }}
      />
    </div>
  )
}

// ── Lock icon ─────────────────────────────────────────────────────────────────

function LockIcon({ color }: { color: string }) {
  return (
    <span className="relative inline-flex flex-col items-center" style={{ width: 10, height: 13 }}>
      <span style={{
        position: 'absolute', top: 0, left: 1, width: 8, height: 6,
        borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}`,
        borderRight: `1.5px solid ${color}`, borderRadius: '4px 4px 0 0',
      }} />
      <span style={{
        position: 'absolute', bottom: 0, left: 0, width: 10, height: 7,
        background: color, borderRadius: 2,
      }} />
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StakePanel({
  userTeam,
  elapsedMs,
  stakingOpen,
  stakedAmount,
  stakedTeam,
  matchStatus,
  score,
  feedEntries,
  onStake,
}: StakePanelProps) {
  const [value,      setValue]      = useState<number>(0.25)
  const [confirming, setConfirming] = useState(false)

  const hasStake   = stakedAmount !== null && stakedTeam !== null
  const isFinished = matchStatus === 'finished'
  const color      = tc(userTeam)
  const colorRaw   = tcRaw(userTeam)
  const activePill = STAKE_AMOUNTS.find(a => Math.abs(a - value) < 0.001) ?? null

  function handleConfirm() {
    onStake(userTeam, value)
    setConfirming(true)
    setTimeout(() => setConfirming(false), 1200)
  }

  // ── Match feed (shared across all states) ────────────────────────────────
  const feedScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = feedScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [feedEntries.length])

  const decisionLogEl = (
    <div className="min-h-0 flex-1 flex flex-col overflow-hidden border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="shrink-0 flex items-center border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          match events
        </span>
      </div>
      <div ref={feedScrollRef} className="flex-1 overflow-y-auto">
        {feedEntries.length === 0 ? (
          <p className="px-3 py-2 text-[11px] italic" style={{ fontFamily: 'var(--font-space-mono)', color: 'var(--text-dim)' }}>
            match events will appear here
          </p>
        ) : (
          feedEntries.map(entry => (
            <div
              key={entry.id}
              className="flex gap-2 border-b px-3 py-1 text-[11px]"
              style={{
                fontFamily:  'var(--font-space-mono)',
                borderColor: 'var(--border)',
                color: entry.team === 'red' ? 'var(--red)' : entry.team === 'blue' ? 'var(--blue)' : 'var(--text-muted)',
              }}
            >
              <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                [{Math.floor(entry.elapsedMs / 60000)}:{String(Math.floor((entry.elapsedMs % 60000) / 1000)).padStart(2, '0')}]
              </span>
              <span>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )

  // ── Match finished ────────────────────────────────────────────────────────
  if (isFinished) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg-panel)' }}>
        <div className="shrink-0 border-t px-3 py-3" style={{ borderColor: 'var(--border)' }}>
          {!hasStake ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>match over</p>
          ) : (() => {
            const winner = score.red > score.blue ? 'red' : score.blue > score.red ? 'blue' : null
            const won    = winner === stakedTeam
            return won ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--gold)' }}>you won!</span>
                <span className="text-xl font-bold" style={{ ...MONO, color: 'var(--gold)' }}>
                  +{(stakedAmount! * 1.5).toFixed(2)} USDC
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>paid automatically via Soroban</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>match over</span>
                <span className="text-sm font-bold" style={{ ...MONO, color: 'var(--red)', textDecoration: 'line-through', opacity: 0.6 }}>
                  {stakedAmount!.toFixed(2)} USDC
                </span>
              </div>
            )
          })()}
        </div>
        {decisionLogEl}
      </div>
    )
  }

  // ── Staking closed ────────────────────────────────────────────────────────
  if (!stakingOpen) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg-panel)' }}>
        <div className="shrink-0 border-t px-3 py-3" style={{ borderColor: 'var(--border)' }}>
          {!hasStake ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>staking closed</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <LockIcon color={color} />
                <span className="text-xs font-bold" style={{ ...MONO, color }}>
                  staked {stakedAmount!.toFixed(2)} USDC
                </span>
              </div>
              <p className="mt-1.5 text-[10px]" style={{ color: 'var(--gold)' }}>
                payout on win: ~{(stakedAmount! * 1.5).toFixed(2)} USDC
              </p>
            </>
          )}
        </div>
        {decisionLogEl}
      </div>
    )
  }

  // ── Staking open ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg-panel)' }}>
      <div className="shrink-0 px-2.5 py-2.5 flex flex-col gap-2">

        {/* Info row — always visible */}
        <div className="flex items-center justify-between">
          <span
            title="Stake USDC on this team. If they win, you get 1.5× back via Soroban smart contract. Staking closes at 2:30."
            className="flex items-center gap-1 cursor-default"
            style={{ color: 'var(--text-dim)', fontSize: 10 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5.25" stroke="currentColor" strokeWidth="1.2"/>
              <text x="6" y="8.5" textAnchor="middle" fontSize="7.5" fill="currentColor" fontWeight="bold">i</text>
            </svg>
            <span className="uppercase tracking-wider" style={{ fontSize: 9 }}>win up to 1.5×</span>
          </span>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--text-dim)' }}>
            {formatCountdown(elapsedMs)}
          </span>
        </div>

        {/* Staked amount — only when has stake */}
        {hasStake && (
          <motion.div
            key={stakedAmount}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-baseline justify-between rounded px-2.5 py-1.5"
            style={{ background: `${colorRaw}14`, border: `1px solid ${colorRaw}33` }}
          >
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>staked</span>
            <span className="text-sm font-bold" style={{ ...MONO, color }}>
              {stakedAmount!.toFixed(2)} <span className="text-[10px] font-normal">USDC</span>
            </span>
          </motion.div>
        )}

        {/* Pills */}
        <div className="flex gap-1.5">
          {STAKE_AMOUNTS.map(a => {
            const active = activePill === a
            return (
              <button
                key={a}
                onClick={() => setValue(a)}
                className="flex-1 rounded py-0.5 text-[10px] transition-all"
                style={{
                  ...MONO,
                  border:     `1px solid ${active ? color : 'var(--border-accent)'}`,
                  background: active ? `${colorRaw}22` : 'transparent',
                  color:      active ? color : 'var(--text-muted)',
                  cursor:     'pointer',
                }}
              >
                {a.toFixed(2)}
              </button>
            )
          })}
        </div>

        {/* Slider + value */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <StakeSlider value={value} colorRaw={colorRaw} onChange={setValue} />
          </div>
          <motion.span
            key={value.toFixed(2)}
            initial={{ opacity: 0.5, scale: 0.9 }}
            animate={{ opacity: 1,   scale: 1   }}
            transition={{ duration: 0.1 }}
            className="w-8 text-right text-[10px] font-bold tabular-nums"
            style={{ ...MONO, color }}
          >
            {value.toFixed(2)}
          </motion.span>
        </div>

        {/* CTA */}
        <AnimatePresence mode="wait">
          {confirming ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded py-1.5 text-center text-[10px] font-bold uppercase tracking-wider"
              style={{ background: `${colorRaw}22`, color, border: `1px solid ${colorRaw}55` }}
            >
              {hasStake ? 'added!' : 'staked!'}
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleConfirm}
              className="w-full rounded py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: color, color: '#0a0a0f', border: 'none', cursor: 'pointer' }}
            >
              {userTeam === 'red' ? 'Go Red!' : 'Go Blue!'}
            </motion.button>
          )}
        </AnimatePresence>

      </div>

      {decisionLogEl}
    </div>
  )
}
