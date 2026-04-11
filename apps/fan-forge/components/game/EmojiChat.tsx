'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Team } from '@/lib/types'

export interface ChatMessage {
  id:     string
  team:   Team
  emoji:  string
  sentAt: number   // Date.now()
  sender: string   // short wallet fragment, e.g. "0x4f..2a"
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

function teamColor(t: Team) { return t === 'red' ? 'var(--red)' : 'var(--blue)' }

function formatTime(ms: number) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function EmojiChat({ team, messages, onEmojiSend, isVisible }: EmojiChatProps) {
  const scrollRef              = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const visible                = messages.slice(-MAX_MESSAGES)
  const accent                 = teamColor(team)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible.length])

  function handleSend() {
    if (!selected) return
    onEmojiSend(selected)
    setSelected(null)
  }

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
          {/* Message feed */}
          <div
            ref={scrollRef}
            className="flex flex-1 flex-col overflow-y-auto px-3 py-2"
          >
            <div className="flex-1" />

            {visible.length === 0 ? (
              <p className="text-center text-[11px] italic" style={{ color: 'var(--text-dim)' }}>
                no messages yet
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <AnimatePresence initial={false}>
                  {visible.map(msg => (
                    <motion.div
                      key={msg.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="flex items-center gap-2 px-1 py-0.5"
                    >
                      {/* Colored dot avatar */}
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: teamColor(msg.team) }}
                      />

                      {/* Wallet ID */}
                      <span className="text-[10px]" style={{ ...MONO, color: 'var(--text-dim)' }}>
                        {msg.sender}
                      </span>

                      {/* Emoji */}
                      <span className="text-sm leading-none">{msg.emoji}</span>

                      {/* Timestamp */}
                      <span
                        className="ml-auto text-[10px]"
                        style={{ ...MONO, color: 'var(--text-dim)', opacity: 0.4 }}
                      >
                        {formatTime(msg.sentAt)}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Input area: pick emoji + send */}
          <div
            className="shrink-0 border-t px-3 py-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              {/* Emoji options */}
              <div className="flex gap-1">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setSelected(prev => prev === emoji ? null : emoji)}
                    className="flex h-7 w-7 items-center justify-center rounded text-sm transition-all"
                    style={{
                      border:     selected === emoji
                        ? `1px solid ${accent}`
                        : '1px solid var(--border-accent)',
                      background: selected === emoji
                        ? `${accent}20`
                        : 'transparent',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!selected}
                className="ml-auto rounded px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all"
                style={{
                  ...MONO,
                  background:  selected ? accent : 'transparent',
                  color:       selected ? '#0a0a0f' : 'var(--text-dim)',
                  border:      `1px solid ${selected ? accent : 'var(--border-accent)'}`,
                  cursor:      selected ? 'pointer' : 'default',
                  opacity:     selected ? 1 : 0.4,
                }}
              >
                send
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
