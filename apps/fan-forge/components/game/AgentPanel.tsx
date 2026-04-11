'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AgentState, AgentStats, Team } from '@/lib/types'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AgentPanelProps {
  agents:      { red: AgentState; blue: AgentState }
  isGridEvent: boolean
  activeTab:   Team
  onTabChange: (team: Team) => void
  onFundAgent: (team: Team, amountUsdc: number) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUND_AMOUNTS = [0.05, 0.10, 0.25] as const

const STAT_LABELS: Record<keyof AgentStats, string> = {
  goalkeeper: 'Goalkeeper · Reflexes',
  defense:    'Defense · Positioning',
  midfield:   'Midfield · Speed',
  forward:    'Forward · Power',
}

const STAT_ORDER: (keyof AgentStats)[] = ['goalkeeper', 'defense', 'midfield', 'forward']

const MONO: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' }

function teamColor(t: Team) {
  return t === 'red' ? 'var(--red)' : 'var(--blue)'
}

function teamBorder(t: Team) {
  return t === 'red' ? 'var(--red-border)' : 'var(--blue-border)'
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Truncates a Stellar wallet address: GABCD...XYZ */
function truncateAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || '—'
  return `${addr.slice(0, 5)}...${addr.slice(-3)}`
}

/** Amount pill selector */
function AmountPills<T extends number>({
  amounts,
  selected,
  onSelect,
  color,
}: {
  amounts: readonly T[]
  selected: T | null
  onSelect: (v: T) => void
  color: string
}) {
  return (
    <div className="flex gap-1.5">
      {amounts.map(a => (
        <button
          key={a}
          onClick={() => onSelect(a)}
          className="rounded px-2 py-0.5 text-[10px] transition-all"
          style={{
            ...MONO,
            border:     `1px solid ${selected === a ? color : 'var(--border-accent)'}`,
            background: selected === a ? `${color}22` : 'transparent',
            color:      selected === a ? color : 'var(--text-muted)',
          }}
        >
          {a.toFixed(2)}
        </button>
      ))}
    </div>
  )
}

/** Single stat row with animated bar */
function StatRow({
  label,
  value,
  color,
  prevValue,
}: {
  label:     string
  value:     number
  color:     string
  prevValue: number
}) {
  const upgraded = value > prevValue
  const [showArrow, setShowArrow] = useState(false)

  useEffect(() => {
    if (upgraded) {
      setShowArrow(true)
      const t = setTimeout(() => setShowArrow(false), 2000)
      return () => clearTimeout(t)
    }
  }, [value, upgraded])

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <AnimatePresence>
            {showArrow && (
              <motion.span
                key="arrow"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[10px] font-bold"
                style={{ color }}
              >
                ↑
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-[10px]" style={{ ...MONO, color: 'var(--text-muted)' }}>
            {value}
          </span>
        </div>
      </div>
      {/* Track */}
      <div className="h-[4px] w-full rounded-full" style={{ background: 'var(--bg-surface)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={false}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

/** Support thermometer — always visible */
function SupportBar({
  redUsdc,
  blueUsdc,
}: {
  redUsdc:  number
  blueUsdc: number
}) {
  const total = redUsdc + blueUsdc
  const redFrac  = total === 0 ? 0.5 : redUsdc  / total
  const blueFrac = total === 0 ? 0.5 : blueUsdc / total

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        fan support
      </span>
      {/* Bar */}
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
        {/* Centre divider */}
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px"
          style={{ background: 'rgba(255,255,255,0.25)' }}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between">
        <span className="text-[10px]" style={{ ...MONO, color: 'var(--red)' }}>
          {redUsdc.toFixed(2)} USDC
        </span>
        <span className="text-[10px]" style={{ ...MONO, color: 'var(--blue)' }}>
          {blueUsdc.toFixed(2)} USDC
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentPanel({
  agents,
  isGridEvent,
  activeTab,
  onTabChange,
  onFundAgent,
}: AgentPanelProps) {
  const agent     = agents[activeTab]
  const color     = teamColor(activeTab)
  const agentName = activeTab === 'red' ? 'AgentRed' : 'AgentBlue'

  // Fund selector state
  const [fundOpen, setFundOpen]         = useState(false)
  const [selectedFund, setSelectedFund] = useState<(typeof FUND_AMOUNTS)[number] | null>(null)

  // Track previous stats for upgrade detection
  const prevStatsRef = useRef<AgentStats>({ ...agent.stats })
  const [prevStats, setPrevStats]         = useState<AgentStats>({ ...agent.stats })

  useEffect(() => {
    if (
      agent.stats.goalkeeper !== prevStatsRef.current.goalkeeper ||
      agent.stats.defense    !== prevStatsRef.current.defense    ||
      agent.stats.midfield   !== prevStatsRef.current.midfield   ||
      agent.stats.forward    !== prevStatsRef.current.forward
    ) {
      setPrevStats({ ...prevStatsRef.current })
      prevStatsRef.current = { ...agent.stats }
    }
  }, [agent.stats])

  // Close fund selector when switching tabs
  useEffect(() => {
    setFundOpen(false)
    setSelectedFund(null)
    prevStatsRef.current = { ...agents[activeTab].stats }
    setPrevStats({ ...agents[activeTab].stats })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  function handleFund(amount: (typeof FUND_AMOUNTS)[number]) {
    setSelectedFund(amount)
    onFundAgent(activeTab, amount)
    setTimeout(() => { setFundOpen(false); setSelectedFund(null) }, 600)
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: 'var(--bg-panel)' }}
    >
      {/* ── Tab switcher ──────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {(['red', 'blue'] as Team[]).map(t => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className="relative flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors"
            style={{
              color:      activeTab === t ? teamColor(t) : 'var(--text-muted)',
              background: 'transparent',
              border:     'none',
            }}
          >
            Team {t === 'red' ? 'Red' : 'Blue'}
            {activeTab === t && (
              <span
                className="absolute inset-x-0 bottom-0 h-[2px]"
                style={{ background: teamColor(t) }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">

        {/* ── Agent identity ────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold" style={{ ...MONO, color }}>
              {agentName}
            </span>
            <span className="text-[10px]" style={{ ...MONO, color: 'var(--text-muted)' }}>
              {truncateAddr(agent.walletAddress)}
            </span>
          </div>

          {/* USDC received — pulses on change */}
          <motion.div
            key={agent.usdcReceived}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col items-end"
          >
            <span className="text-base font-bold leading-none" style={{ ...MONO, color }}>
              {agent.usdcReceived.toFixed(2)}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>USDC</span>
          </motion.div>
        </div>

        {/* ── Fund agent ────────────────────────────────────────────── */}
        {!isGridEvent && (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false} mode="wait">
              {!fundOpen ? (
                <motion.button
                  key="open"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => setFundOpen(true)}
                  className="w-full rounded py-1.5 text-xs transition-colors"
                  style={{
                    ...MONO,
                    border:     `1px solid ${teamBorder(activeTab)}`,
                    background: 'transparent',
                    color,
                  }}
                >
                  fund agent
                </motion.button>
              ) : (
                <motion.div
                  key="pills"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2"
                >
                  <AmountPills
                    amounts={FUND_AMOUNTS}
                    selected={selectedFund}
                    onSelect={handleFund}
                    color={color}
                  />
                  <button
                    onClick={() => { setFundOpen(false); setSelectedFund(null) }}
                    className="text-[10px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ✕
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Stat bars ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">
          {STAT_ORDER.map(role => (
            <StatRow
              key={role}
              label={STAT_LABELS[role]}
              value={agent.stats[role]}
              color={color}
              prevValue={prevStats[role]}
            />
          ))}
        </div>

        {/* ── Support thermometer ───────────────────────────────────── */}
        <SupportBar
          redUsdc={agents.red.usdcReceived}
          blueUsdc={agents.blue.usdcReceived}
        />

        {/* Active boost indicator */}
        {agent.activeBoost && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 rounded border px-3 py-2"
            style={{ borderColor: teamBorder(activeTab), background: `${color}11` }}
          >
            <span className="text-xs font-bold" style={{ color }}>⚡</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
              boost active ×1.5
            </span>
          </motion.div>
        )}

      </div>
    </div>
  )
}
