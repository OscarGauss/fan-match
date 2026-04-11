'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MatchCanvas      from '@/components/game/MatchCanvas'
import AgentPanel       from '@/components/game/AgentPanel'
import AgentDecisionLog from '@/components/game/AgentDecisionLog'
import EmojiChat        from '@/components/game/EmojiChat'
import GridEvent        from '@/components/game/GridEvent'
import StakePanel       from '@/components/game/StakePanel'
import { GameEngine }   from '@/lib/gameEngine'
import type { DecisionLogEntry, MatchState, Team } from '@/lib/types'
import type { ChatMessage } from '@/components/game/EmojiChat'
import { MATCH_DURATION_MS } from '@/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimer(elapsedMs: number) {
  const rem = Math.max(0, MATCH_DURATION_MS - elapsedMs)
  const s   = Math.ceil(rem / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

let chatSeq = 0

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamePage() {
  // ── Engine (singleton, never re-created) ─────────────────────────────────
  const engineRef    = useRef<GameEngine | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastSimRef   = useRef<number>(0)

  if (!engineRef.current) {
    engineRef.current = new GameEngine('GAGENTR3DXYZ', 'GAGENTB7WXYZ')
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const [matchState,   setMatchState]   = useState<MatchState>(() => engineRef.current!.getState())
  const [decisionLog,  setDecisionLog]  = useState<DecisionLogEntry[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [agentTab,     setAgentTab]     = useState<Team>('red')
  const [userTeam]                      = useState<Team>('red')
  const [stakedAmount, setStakedAmount] = useState<number | null>(null)
  const [stakedTeam,   setStakedTeam]   = useState<Team | null>(null)

  // ── Game loop — 100 ms tick ───────────────────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current!

    const id = setInterval(() => {
      if (!startTimeRef.current) startTimeRef.current = Date.now()
      const elapsed = Date.now() - startTimeRef.current

      // Tick returns the (mutated) engine state
      const ticked = engine.tick(elapsed)

      // Snapshot all primitive/shallow values to avoid stale-closure issues
      const snap = {
        status:      ticked.status,
        elapsedMs:   ticked.elapsedMs,
        stakingOpen: ticked.stakingOpen,
        score:       { ...ticked.score },
        agents: {
          red:  { ...ticked.agents.red,  stats: { ...ticked.agents.red.stats  } },
          blue: { ...ticked.agents.blue, stats: { ...ticked.agents.blue.stats } },
        },
        ge: ticked.currentGridEvent,
      }

      setMatchState(prev => ({
        status:      snap.status,
        elapsedMs:   snap.elapsedMs,
        stakingOpen: snap.stakingOpen,
        score:       snap.score,
        agents:      snap.agents,
        // Preserve React-managed grid & pixelsLeft while same event is active
        currentGridEvent: snap.ge === null ? null : {
          ...snap.ge,
          grid:       prev.currentGridEvent?.id === snap.ge.id
            ? prev.currentGridEvent.grid
            : snap.ge.grid,
          pixelsLeft: prev.currentGridEvent?.id === snap.ge.id
            ? prev.currentGridEvent.pixelsLeft
            : snap.ge.pixelsLeft,
        },
      }))

      // ── Agent simulation every 30 s (match active only) ─────────────────
      if (snap.status === 'active' && elapsed - lastSimRef.current >= 30_000) {
        lastSimRef.current = elapsed
        const simTeam: Team = Math.random() < 0.5 ? 'red' : 'blue'
        const amount        = Math.round((0.05 + Math.random() * 0.10) * 100) / 100
        const entries       = engine.applyAgentFunding(simTeam, amount)
        setDecisionLog(prev => [...prev, ...entries].slice(-100))
      }
    }, 100)

    return () => clearInterval(id)
  }, []) // engine and refs are stable — no deps needed

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGoal = useCallback((team: Team) => {
    engineRef.current!.processGoal(team)
    // Header score update is immediate; engine state converges on next tick
    setMatchState(prev => ({
      ...prev,
      score: { ...prev.score, [team]: prev.score[team] + 1 },
    }))
  }, [])

  const handleFundAgent = useCallback((team: Team, amount: number) => {
    const entries = engineRef.current!.applyAgentFunding(team, amount)
    setDecisionLog(prev => [...prev, ...entries].slice(-100))
    // Updated agent stats propagate on next tick automatically
  }, [])

  const handlePaintPixel = useCallback((row: number, col: number) => {
    setMatchState(prev => {
      const ge = prev.currentGridEvent
      if (!ge || ge.pixelsLeft[userTeam] <= 0) return prev
      const cellVal = userTeam === 'red' ? 1 : 2
      if (ge.grid[row][col] === cellVal) return prev
      return {
        ...prev,
        currentGridEvent: {
          ...ge,
          grid:       ge.grid.map((r, ri) =>
            r.map((cell, ci) => ri === row && ci === col ? cellVal : cell)
          ),
          pixelsLeft: { ...ge.pixelsLeft, [userTeam]: ge.pixelsLeft[userTeam] - 1 },
        },
      }
    })
  }, [userTeam])

  const handleBuyPixels = useCallback((count: number) => {
    setMatchState(prev => {
      const ge = prev.currentGridEvent
      if (!ge) return prev
      return {
        ...prev,
        currentGridEvent: {
          ...ge,
          pixelsLeft: { ...ge.pixelsLeft, [userTeam]: ge.pixelsLeft[userTeam] + count },
        },
      }
    })
  }, [userTeam])

  const handleEventEnd = useCallback((winner: Team) => {
    engineRef.current!.applyGridEventResult(winner)
    // Status reverts to 'active' on next engine tick
  }, [])

  const handleEmojiSend = useCallback((emoji: string) => {
    setChatMessages(prev => [
      ...prev,
      { id: String(++chatSeq), team: userTeam, emoji, sentAt: Date.now() },
    ].slice(-20))
  }, [userTeam])

  const handleStake = useCallback((team: Team, amount: number) => {
    setStakedTeam(team)
    setStakedAmount(amount)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const isGrid  = matchState.status === 'grid_event'
  const score   = matchState.score
  const timer   = formatTimer(matchState.elapsedMs)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--bg-root)' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="flex h-14 shrink-0 items-center justify-between border-b px-5"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}
      >
        {/* Logo */}
        <div className="flex items-baseline">
          <span className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Fan</span>
          <span className="text-lg font-black" style={{ color: 'var(--red)' }}>Forge</span>
        </div>

        {/* Timer + Score */}
        <div className="flex items-center gap-5">
          <span
            className="text-sm font-bold tracking-widest"
            style={{ fontFamily: 'var(--font-space-mono)', color: 'var(--text-muted)' }}
          >
            {timer}
          </span>
          <div
            className="flex items-center gap-2 text-xl font-bold"
            style={{ fontFamily: 'var(--font-space-mono)' }}
          >
            <span style={{ color: 'var(--red)'      }}>{score.red}</span>
            <span style={{ color: 'var(--text-dim)' }}>:</span>
            <span style={{ color: 'var(--blue)'     }}>{score.blue}</span>
          </div>
        </div>

        {/* Profile */}
        <button
          className="h-8 w-8 rounded-full border text-xs transition-colors"
          style={{
            fontFamily:  'var(--font-space-mono)',
            borderColor: 'var(--border-accent)',
            background:  'var(--bg-surface)',
            color:       'var(--text-muted)',
          }}
        >
          0x
        </button>
      </header>

      {/* ── Body — two columns ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left column (65%) ─────────────────────────────────────── */}
        <div
          className="flex flex-col overflow-hidden border-r"
          style={{ flex: '65 65 0%', borderColor: 'var(--border)' }}
        >
          {/* Match canvas — fills top, play-by-play feed included */}
          <div
            className="flex-1 overflow-hidden border-b"
            style={{ borderColor: 'var(--border)', minHeight: 340 }}
          >
            <MatchCanvas matchState={matchState} onGoal={handleGoal} />
          </div>

          {/* Emoji chat / Grid event — fixed bottom strip */}
          <div className="relative overflow-hidden" style={{ height: 240 }}>
            <AnimatePresence mode="wait">
              {isGrid && matchState.currentGridEvent ? (
                <motion.div
                  key="grid-event"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  <GridEvent
                    gridEvent={matchState.currentGridEvent}
                    elapsedMs={matchState.elapsedMs}
                    team={userTeam}
                    onPaintPixel={handlePaintPixel}
                    onBuyPixels={handleBuyPixels}
                    onEventEnd={handleEventEnd}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="emoji-chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  <EmojiChat
                    team={userTeam}
                    messages={chatMessages}
                    onEmojiSend={handleEmojiSend}
                    isVisible
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right column (35%) ────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden" style={{ flex: '35 35 0%' }}>
          {/* Agent panel — scrollable, fixed height */}
          <div
            className="overflow-hidden border-b"
            style={{ borderColor: 'var(--border)', height: 360 }}
          >
            <AgentPanel
              agents={matchState.agents}
              isGridEvent={isGrid}
              activeTab={agentTab}
              onTabChange={setAgentTab}
              onFundAgent={handleFundAgent}
            />
          </div>

          {/* Stake panel — compact strip */}
          <StakePanel
            stakingOpen={matchState.stakingOpen}
            stakedAmount={stakedAmount}
            stakedTeam={stakedTeam}
            matchStatus={matchState.status}
            score={matchState.score}
            onStake={handleStake}
          />

          {/* Agent decision log — fills remaining height */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 100 }}>
            <AgentDecisionLog entries={decisionLog} activeTab={agentTab} />
          </div>
        </div>

      </div>
    </div>
  )
}
