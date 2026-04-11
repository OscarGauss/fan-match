'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DecisionLogEntry, Team } from '@/lib/types'

export interface AgentDecisionLogProps {
  entries:   DecisionLogEntry[]
  activeTab: Team
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' }
const GREEN = '#00ff88'

function teamColor(t: Team) {
  return t === 'red' ? 'var(--red)' : 'var(--blue)'
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Truncate GABCDEFGH...XYZ */
function truncateAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 5)}...${addr.slice(-3)}`
}

// ── Entry renderers ───────────────────────────────────────────────────────────

function ReceivedFunds({ entry, color }: { entry: DecisionLogEntry; color: string }) {
  // message: "received 0.08 USDC from fan_0x3a"
  const parts = entry.message.match(/^(received )([\d.]+)( USDC.*)$/)
  return (
    <span style={{ color: 'var(--text-muted)' }}>
      {parts ? (
        <>
          {parts[1]}
          <span style={{ color }}>{parts[2]}</span>
          {parts[3]}
        </>
      ) : entry.message}
    </span>
  )
}

function Analyzing({ entry }: { entry: DecisionLogEntry }) {
  return (
    <span style={{ color: 'var(--text-muted)' }}>
      {entry.message}
    </span>
  )
}

function Decision({ entry, color }: { entry: DecisionLogEntry; color: string }) {
  // message: "→ upgrading defense positioning"
  const arrow = entry.message.startsWith('→')
  return (
    <span style={{ color, fontWeight: 700 }}>
      {arrow ? (
        <>
          <span style={{ color }}>→</span>
          {entry.message.slice(1)}
        </>
      ) : entry.message}
    </span>
  )
}

function TxConfirmed({ entry, color }: { entry: DecisionLogEntry; color: string }) {
  // message: "tx confirmed · GABCD...XYZ → contract · 0.08 USDC · stellar testnet"
  // Parse: address, amount
  const addrMatch   = entry.message.match(/([A-Z0-9]{5,}\.{3}[A-Z0-9]{3}|G[A-Z0-9]{54})/)
  const amountMatch = entry.message.match(/([\d.]+) USDC/)
  const addr   = addrMatch  ? addrMatch[1]  : ''
  const amount = amountMatch ? amountMatch[1] : ''

  return (
    <span>
      <span style={{ color: GREEN }}>✓ </span>
      {addr && <span style={{ ...MONO, color: 'var(--text-muted)' }}>{addr} </span>}
      {amount && <span style={{ ...MONO, color }}>·{amount} USDC</span>}
      <span style={{ color: 'var(--text-muted)' }}> · testnet</span>
    </span>
  )
}

// ── Single log row ────────────────────────────────────────────────────────────

function LogRow({ entry, color }: { entry: DecisionLogEntry; color: string }) {
  const isDecision = entry.type === 'decision'
  const isAnalyzing = entry.type === 'analyzing'

  return (
    <motion.div
      layout
      initial={isDecision ? { opacity: 0, y: 6 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex gap-1.5 py-0.5 text-[11px] leading-relaxed"
      style={{
        ...MONO,
        paddingLeft: isAnalyzing ? 8 : 0,
      }}
    >
      {/* Timestamp */}
      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
        [{formatMs(entry.timestamp)}]
      </span>

      {/* Content */}
      <span className="min-w-0 break-words">
        {entry.type === 'received_funds' && <ReceivedFunds entry={entry} color={color} />}
        {entry.type === 'analyzing'      && <Analyzing entry={entry} />}
        {entry.type === 'decision'       && <Decision entry={entry} color={color} />}
        {entry.type === 'tx_confirmed'   && <TxConfirmed entry={entry} color={color} />}
      </span>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentDecisionLog({ entries, activeTab }: AgentDecisionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const color     = teamColor(activeTab)
  const visible   = entries.filter(e => e.team === activeTab)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible.length])

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: 'var(--bg-surface)' }}
    >
      {/* Label row */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Pulsing live dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: GREEN }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ background: GREEN }}
          />
        </span>
        <span
          className="text-[10px] uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}
        >
          agent decisions
        </span>
      </div>

      {/* Entries */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col overflow-y-auto px-3 py-2"
      >
        {visible.length === 0 ? (
          <p
            className="m-auto text-[11px] italic"
            style={{ color: 'var(--text-muted)' }}
          >
            waiting for fan support...
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {visible.map(e => (
              <LogRow key={`${e.timestamp}-${e.type}`} entry={e} color={color} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
