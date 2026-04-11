'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GridEventState, Team } from '@/lib/types'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GridEventProps {
  gridEvent:    GridEventState
  elapsedMs:    number
  team:         Team
  onPaintPixel: (row: number, col: number) => void
  onBuyPixels:  (count: number) => void
  onEventEnd?:  (winner: Team) => void
  onToast?:     () => void
  /** When true, hides the internal header (parent provides its own tab bar) */
  hideHeader?:  boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL_SIZE = 18
const CELL_GAP  = 2

const BUY_OPTIONS = [
  { count: 3,  label: '+3 px · 0.03' },
  { count: 10, label: '+10 px · 0.10' },
] as const

const DIFFICULTY_LABEL = ['EASY', 'MEDIUM', 'HARD'] as const
const DIFFICULTY_COLOR = ['var(--gold)', 'var(--blue)', 'var(--red)'] as const

const MONO: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function tc(t: Team) { return t === 'red' ? 'var(--red)' : 'var(--blue)' }
function cv(t: Team) { return t === 'red' ? 1 : 2 }

function computeProgress(gridEvent: GridEventState, team: Team) {
  const val = cv(team)
  let painted = 0, total = 0
  for (let r = 0; r < gridEvent.grid.length; r++) {
    for (let c = 0; c < (gridEvent.grid[r]?.length ?? 0); c++) {
      if (gridEvent.targetShape[r]?.[c] === 1) {
        total++
        if (gridEvent.grid[r][c] === val) painted++
      }
    }
  }
  return total === 0 ? 0 : Math.round((painted / total) * 100)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GridEvent({
  gridEvent,
  elapsedMs,
  team,
  onPaintPixel,
  onBuyPixels,
  onEventEnd,
  onToast,
  hideHeader,
}: GridEventProps) {
  const secondsLeft = Math.max(0, Math.ceil((gridEvent.endMs - elapsedMs) / 1000))
  const isOver      = elapsedMs >= gridEvent.endMs
  const myValue     = cv(team)
  const color       = tc(team)
  const pixelsLeft  = gridEvent.pixelsLeft[team]
  const diffIdx     = Math.min(gridEvent.id - 1, 2)

  const [freshPainted, setFreshPainted] = useState<Set<string>>(new Set())
  const [buyOpen, setBuyOpen]           = useState(false)

  const winner = useMemo<Team | null>(() => {
    if (!isOver) return null
    const r = computeProgress(gridEvent, 'red')
    const b = computeProgress(gridEvent, 'blue')
    return r >= b ? 'red' : 'blue'
  }, [isOver, gridEvent])

  useEffect(() => {
    if (!winner || !onEventEnd) return
    const t = setTimeout(() => onEventEnd(winner), 2000)
    return () => clearTimeout(t)
  }, [winner, onEventEnd])

  const handleCellClick = useCallback((row: number, col: number) => {
    if (pixelsLeft <= 0) return
    if (gridEvent.grid[row][col] === myValue) return
    if (isOver) return

    onPaintPixel(row, col)
    onToast?.()

    const key = `${row}-${col}`
    setFreshPainted(prev => new Set([...prev, key]))
    setTimeout(() => {
      setFreshPainted(prev => { const n = new Set(prev); n.delete(key); return n })
    }, 250)
  }, [pixelsLeft, gridEvent.grid, myValue, isOver, onPaintPixel, onToast])

  const rows = gridEvent.grid.length
  const cols = gridEvent.grid[0]?.length ?? 12

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{ background: 'var(--bg-panel)' }}
    >
      {/* ── Header (hidden when parent provides tab bar) ─────────────── */}
      {!hideHeader && (
        <div
          className="flex shrink-0 items-center justify-between border-b px-3 py-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-xs font-bold uppercase tracking-widest" style={{ ...MONO, color }}>
            Grid Event #{gridEvent.id}
          </span>

          <motion.span
            className="text-xl font-bold tabular-nums"
            style={{ ...MONO, color }}
            animate={secondsLeft > 0 && secondsLeft <= 10 ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={secondsLeft <= 10 ? { duration: 0.5, repeat: Infinity, repeatType: 'loop' } : { duration: 0 }}
          >
            {secondsLeft}s
          </motion.span>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* Pixel grid */}
        <div className="flex flex-1 items-center justify-center p-3">
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
              gridTemplateRows:    `repeat(${rows}, ${CELL_SIZE}px)`,
              gap:                 `${CELL_GAP}px`,
            }}
          >
            {gridEvent.grid.flatMap((rowArr, r) =>
              rowArr.map((cellVal, c) => {
                const isTarget  = gridEvent.targetShape[r]?.[c] === 1
                const isMyCell  = cellVal === myValue
                const isEmpty   = cellVal === 0
                const clickable = !isMyCell && pixelsLeft > 0 && !isOver
                const key       = `${r}-${c}`
                const isFresh   = freshPainted.has(key)

                let bg: string
                if (cellVal === 1)      bg = 'var(--red)'
                else if (cellVal === 2) bg = 'var(--blue)'
                else if (isTarget)      bg = 'rgba(255,255,255,0.05)'
                else                    bg = 'var(--bg-surface)'

                let border: string
                if (isTarget && isEmpty) border = '1px solid var(--border-accent)'
                else if (!isEmpty)       border = 'none'
                else                     border = '1px solid var(--border)'

                return (
                  <motion.div
                    key={key}
                    animate={isFresh ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => handleCellClick(r, c)}
                    style={{
                      width:        CELL_SIZE,
                      height:       CELL_SIZE,
                      borderRadius: 2,
                      background:   bg,
                      border,
                      cursor:       clickable ? 'pointer' : 'default',
                      transition:   'background 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!clickable) return
                      ;(e.currentTarget as HTMLDivElement).style.background = `${color}66`
                    }}
                    onMouseLeave={e => {
                      if (!clickable) return
                      ;(e.currentTarget as HTMLDivElement).style.background = bg
                    }}
                  />
                )
              })
            )}
          </div>
        </div>

        {/* ── Info panel ─────────────────────────────────────────────── */}
        <div
          className="flex w-[152px] shrink-0 flex-col gap-2 overflow-hidden border-l p-2"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
        >
          {/* Target figure + difficulty */}
          <div className="flex items-start gap-2">
            {/* Mini grid */}
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: `repeat(${gridEvent.targetShape[0]?.length ?? 12}, 4px)`,
                gap:                 '1px',
                flexShrink:          0,
              }}
            >
              {gridEvent.targetShape.flat().map((cell, i) => (
                <div
                  key={i}
                  style={{
                    width:        4,
                    height:       4,
                    borderRadius: 1,
                    background:   cell === 1 ? 'rgba(255,255,255,0.25)' : 'var(--bg-panel)',
                  }}
                />
              ))}
            </div>

            {/* Difficulty badge */}
            <span
              className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{
                ...MONO,
                color:      DIFFICULTY_COLOR[diffIdx],
                border:     `1px solid ${DIFFICULTY_COLOR[diffIdx]}`,
                background: `${DIFFICULTY_COLOR[diffIdx]}18`,
                whiteSpace: 'nowrap',
              }}
            >
              {DIFFICULTY_LABEL[diffIdx]}
            </span>
          </div>

          <div className="h-px shrink-0" style={{ background: 'var(--border)' }} />

          {/* Pixels remaining */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              your pixels
            </span>

            <div className="flex items-center gap-1.5">
              {/* Dots */}
              <div className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: i < Math.min(pixelsLeft, 3) ? color : 'var(--bg-panel)',
                      border:     '1px solid var(--border-accent)',
                    }}
                  />
                ))}
              </div>

              {/* Count */}
              <span className="text-sm font-bold" style={{ ...MONO, color }}>
                {pixelsLeft}
              </span>

              {/* Buy button */}
              <button
                onClick={() => setBuyOpen(o => !o)}
                className="ml-auto rounded px-1.5 py-0.5 text-[9px] transition-colors"
                style={{ ...MONO, border: `1px solid ${color}`, color, background: 'transparent' }}
              >
                buy
              </button>
            </div>

            {/* Buy options */}
            <AnimatePresence>
              {buyOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-1 overflow-hidden"
                >
                  {BUY_OPTIONS.map(opt => (
                    <button
                      key={opt.count}
                      onClick={() => { onBuyPixels(opt.count); setBuyOpen(false) }}
                      className="w-full rounded py-1 text-[9px] transition-all"
                      style={{
                        ...MONO,
                        border:     '1px solid var(--border-accent)',
                        background: 'var(--bg-panel)',
                        color:      'var(--text-muted)',
                      }}
                      onMouseEnter={e => {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = color
                        ;(e.currentTarget as HTMLButtonElement).style.color = color
                      }}
                      onMouseLeave={e => {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Result overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {winner && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(10,10,15,0.82)', zIndex: 20 }}
          >
            <span
              className="text-2xl font-black uppercase tracking-widest"
              style={{ ...MONO, color: tc(winner) }}
            >
              {winner === 'red' ? 'AgentRed' : 'AgentBlue'}
            </span>
            <span className="text-xs font-bold" style={{ color: tc(winner) }}>
              wins the grid event
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              → {winner === 'red' ? 'AgentRed' : 'AgentBlue'} receives ×1.5 boost
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
