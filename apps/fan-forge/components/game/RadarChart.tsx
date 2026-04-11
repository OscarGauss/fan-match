'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { AgentStats, Team } from '@/lib/types'
import { STAT_LABELS } from '@/lib/constants'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RadarChartProps {
  stats:     AgentStats
  team:      Team
  prevStats?: AgentStats
}

// ── Geometry constants ────────────────────────────────────────────────────────

const CX            = 100
const CY            = 100
const OUTER_RADIUS  = 72
const LABEL_OFFSET  = 16        // px beyond outer vertex
const VALUE_INSET   = 10        // px toward center from data vertex
const START_DEG     = 270       // top
const STEP_DEG      = 72        // 360 / 5

// Axis order clockwise from top: GK → DEF → FWD → COO → MID
const AXIS_ORDER: (keyof AgentStats)[] = [
  'goalkeeper',
  'defense',
  'forward',
  'coordination',
  'midfield',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function axisAngleDeg(i: number) {
  return START_DEG + i * STEP_DEG
}

function vertexAt(value: number, index: number, outerR = OUTER_RADIUS) {
  const rad = toRad(axisAngleDeg(index))
  const r   = (value / 100) * outerR
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function pointsStr(stats: AgentStats) {
  return AXIS_ORDER.map((k, i) => {
    const v = vertexAt(stats[k], i)
    return `${v.x},${v.y}`
  }).join(' ')
}

function refPentagonPoints(fraction: number) {
  return AXIS_ORDER.map((_, i) => {
    const v = vertexAt(fraction * 100, i)
    return `${v.x},${v.y}`
  }).join(' ')
}

function labelPos(index: number) {
  const rad = toRad(axisAngleDeg(index))
  const r   = OUTER_RADIUS + LABEL_OFFSET
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

// Decide SVG text-anchor based on the axis angle
function textAnchor(index: number): 'middle' | 'start' | 'end' {
  const deg = ((axisAngleDeg(index)) % 360 + 360) % 360
  if (deg > 255 && deg < 285) return 'middle'   // ≈ top
  if (deg >  75 && deg < 105) return 'middle'   // ≈ bottom
  if (deg >= 285 || deg <= 75) return 'start'   // right side
  return 'end'                                   // left side
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RadarChart({ stats, team, prevStats }: RadarChartProps) {
  const color     = team === 'red' ? '#ff4d4d' : '#4d9fff'
  const fillColor = team === 'red' ? '#ff4d4d26' : '#4d9fff26'

  const points = pointsStr(stats)

  // Which stats just upgraded
  const [upgraded, setUpgraded] = useState<Set<keyof AgentStats>>(new Set())

  useEffect(() => {
    if (!prevStats) return
    const fresh = new Set<keyof AgentStats>()
    for (const key of AXIS_ORDER) {
      if (stats[key] > prevStats[key]) fresh.add(key)
    }
    if (fresh.size === 0) return
    setUpgraded(fresh)
    const t = setTimeout(() => setUpgraded(new Set()), 2000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats])

  return (
    <svg viewBox="0 0 200 200" className="w-full" style={{ maxHeight: '180px' }}>

      {/* ── Reference pentagons ── */}
      {[0.25, 0.5, 0.75].map(f => (
        <polygon
          key={f}
          points={refPentagonPoints(f)}
          fill="none"
          stroke="#ffffff08"
          strokeWidth="0.5"
        />
      ))}

      {/* ── Axis lines ── */}
      {AXIS_ORDER.map((_, i) => {
        const outer = vertexAt(100, i)
        return (
          <line
            key={i}
            x1={CX} y1={CY}
            x2={outer.x} y2={outer.y}
            stroke="#ffffff10"
            strokeWidth="0.5"
          />
        )
      })}

      {/* ── Data polygon ── */}
      <motion.polygon
        points={points}
        fill={fillColor}
        stroke={color}
        strokeWidth="1.5"
        animate={{ points }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />

      {/* ── Vertex dots ── */}
      {AXIS_ORDER.map((key, i) => {
        const v = vertexAt(stats[key], i)
        return <circle key={key} cx={v.x} cy={v.y} r={3} fill={color} />
      })}

      {/* ── Axis labels + upgrade arrows ── */}
      {AXIS_ORDER.map((key, i) => {
        const lp     = labelPos(i)
        const anchor = textAnchor(i)
        // Offset ↑ to sit just after the label
        const arrowDx = anchor === 'start' ? 14 : anchor === 'end' ? -14 : 0
        const arrowDy = anchor === 'middle' ? -10 : 0

        return (
          <g key={key}>
            <text
              x={lp.x} y={lp.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="9"
              fill="#555566"
            >
              {STAT_LABELS[key]}
            </text>

            {upgraded.has(key) && (
              <motion.text
                x={lp.x + arrowDx} y={lp.y + arrowDy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fill={color}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 2, ease: 'easeOut' }}
              >
                ↑
              </motion.text>
            )}
          </g>
        )
      })}

      {/* ── Stat values ── */}
      {AXIS_ORDER.map((key, i) => {
        const v       = vertexAt(stats[key], i)
        const rad     = toRad(axisAngleDeg(i))
        const vx      = v.x - VALUE_INSET * Math.cos(rad)
        const vy      = v.y - VALUE_INSET * Math.sin(rad)

        return (
          <motion.g
            key={`${key}-${stats[key]}`}
            style={{ transformOrigin: `${vx}px ${vy}px` }}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <text
              x={vx} y={vy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill={color}
              fontFamily="var(--font-space-mono, monospace)"
            >
              {stats[key]}
            </text>
          </motion.g>
        )
      })}

    </svg>
  )
}
