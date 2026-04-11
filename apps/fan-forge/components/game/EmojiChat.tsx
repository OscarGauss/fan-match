'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Team } from '@/lib/types'

export interface ChatMessage {
  id:    string
  team:  Team
  emoji: string
  sentAt: number  // Date.now()
}

export interface EmojiChatProps {
  team:        Team
  messages:    ChatMessage[]
  onEmojiSend: (emoji: string) => void
  isVisible:   boolean
}

const EMOJI_OPTIONS = ['🔴', '🔵', '⬆️', '⬇️', '🎯'] as const
const MAX_MESSAGES  = 20
const MONO: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' }

function teamColor(t: Team)     { return t === 'red' ? 'var(--red)'        : 'var(--blue)'        }
function teamBorderDim(t: Team) { return t === 'red' ? 'var(--red-border)'  : 'var(--blue-border)' }

function formatTime(ms: number) {
  const d = new Date(ms)
  return `${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

export default function EmojiChat({ team, messages, onEmojiSend, isVisible }: EmojiChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const visible   = messages.slice(-MAX_MESSAGES)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible.length])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="emoji-chat"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-full flex-col overflow-hidden"
          style={{ background: 'var(--bg-surface)' }}
        >
          {/* Label */}
          <div
            className="flex shrink-0 items-center border-b px-3 py-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              coordinate
            </span>
          </div>

          {/* Message feed */}
          <div
            ref={scrollRef}
            className="flex flex-1 flex-col justify-end gap-0.5 overflow-y-auto px-2 py-2"
          >
            {visible.length === 0 ? (
              <p
                className="text-center text-[11px] italic"
                style={{ color: 'var(--text-dim)' }}
              >
                no messages yet
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {visible.map(msg => (
                  <motion.div
                    key={msg.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="flex items-center gap-2 rounded px-2 py-0.5"
                    style={{
                      borderLeft: `2px solid ${teamBorderDim(msg.team)}`,
                    }}
                  >
                    {/* Team dot */}
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: teamColor(msg.team) }}
                    />
                    {/* Emoji */}
                    <span className="text-base leading-none">{msg.emoji}</span>
                    {/* Timestamp */}
                    <span
                      className="ml-auto text-[10px]"
                      style={{ ...MONO, color: 'var(--text-dim)' }}
                    >
                      {formatTime(msg.sentAt)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Emoji picker */}
          <div
            className="shrink-0 border-t px-3 py-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex gap-1.5">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onEmojiSend(emoji)}
                  className="flex h-9 w-9 items-center justify-center rounded text-base transition-all"
                  style={{
                    border:     '1px solid var(--border-accent)',
                    background: 'var(--bg-surface)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = teamColor(team)
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <p
              className="mt-1.5 text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              coordinate before the grid event
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
