'use client';

import AgentDecisionLog from '@/components/game/AgentDecisionLog';
import type { AgentView } from '@/components/game/AgentPanel';
import AgentPanel from '@/components/game/AgentPanel';
import type { ChatMessage } from '@/components/game/EmojiChat';
import GridEvent from '@/components/game/GridEvent';
import type { FeedEntry } from '@/components/game/MatchCanvas';
import MatchCanvas from '@/components/game/MatchCanvas';
import StakePanel from '@/components/game/StakePanel';
import {
  FREE_PIXELS_PER_EVENT,
  GRID_COLS,
  GRID_ROUND_DURATION_MS,
  GRID_ROWS,
  GRID_TARGETS,
  MATCH_DURATION_MS,
} from '@/lib/constants';
import { GameEngine } from '@/lib/gameEngine';
import type { DecisionLogEntry, GridEventState, MatchState, Team } from '@/lib/types';
import { GiftOverlay, LiveChat } from '@fan-match/live-chat';
import { usePollar, WalletButton } from '@pollar/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

const CHAT_API = `${process.env.NEXT_PUBLIC_CHAT_API_URL ?? 'http://localhost:3001'}/api`;

const USDC_ISSUER: Record<string, string> = {
  testnet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  mainnet: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimer(elapsedMs: number) {
  const rem = Math.max(0, MATCH_DURATION_MS - elapsedMs);
  const s = Math.ceil(rem / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let chatSeq = 0;
let notifSeq = 0;

function makeWalletId() {
  const hex = () =>
    Math.floor(Math.random() * 0xff)
      .toString(16)
      .padStart(2, '0');
  return `0x${hex()}..${hex()}`;
}

const TX_GREEN = '#00ff88';
const MONO_FONT: React.CSSProperties = { fontFamily: 'var(--font-space-mono)' };

interface Notification {
  id: string;
  type: 'tx' | 'round';
  msg?: string;
}

// ── Team toggle (header) ──────────────────────────────────────────────────────

function TeamToggle({ value, onChange }: { value: Team; onChange: (t: Team) => void }) {
  return (
    <div
      className="flex overflow-hidden rounded"
      style={{ border: '1px solid var(--border-accent)' }}
    >
      {(['red', 'blue'] as Team[]).map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-all"
            style={{
              fontFamily: 'var(--font-space-mono)',
              background: active ? (t === 'red' ? 'var(--red)' : 'var(--blue)') : 'transparent',
              color: active ? '#0a0a0f' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t === 'red' ? 'Red' : 'Blue'}
          </button>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamePage() {
  return (
    <Suspense>
      <GamePageInner />
    </Suspense>
  );
}

function GamePageInner() {
  // ── Engine ───────────────────────────────────────────────────────────────
  const engineRef = useRef<GameEngine | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastSimRef = useRef<number>(0);
  const myWalletId = useRef<string>(makeWalletId());
  const elapsedMsRef = useRef<number>(0); // always-fresh elapsed for callbacks

  if (!engineRef.current) {
    engineRef.current = new GameEngine('GAGENTR3DXYZ', 'GAGENTB7WXYZ');
  }

  // ── External integrations (Pollar / search params) ────────────────────────
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId') ?? '';
  const recipientWallet = searchParams.get('ownerWallet') ?? '';
  const { walletAddress, getClient, isAuthenticated, network } = usePollar();

  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (!matchId) return;
    fetch(`/api/matches/${matchId}/room`, { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.roomId) setRoomId(data.roomId);
      })
      .catch(console.error);
  }, [matchId]);

  useEffect(() => {
    if (!isAuthenticated || !walletAddress) return;
    const chatApi = process.env.NEXT_PUBLIC_CHAT_API_URL ?? 'http://localhost:3001';
    fetch(`${chatApi}/api/auth/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    })
      .then((r) => r.json())
      .then((user) => {
        if (user.username) setUsername(user.username);
      })
      .catch(console.error);
  }, [isAuthenticated, walletAddress]);

  // ── Fetch agent public keys once on mount ────────────────────────────────
  useEffect(() => {
    async function fetchKeys() {
      try {
        const [red, blue] = await Promise.all([
          fetch('/api/agent/balance?agentId=red').then((r) => r.json()),
          fetch('/api/agent/balance?agentId=blue').then((r) => r.json()),
        ]);
        setAgentKeys({ red: red.publicKey ?? '', blue: blue.publicKey ?? '' });
      } catch {
        // leave keys empty — FundSection will catch the error gracefully
      }
    }
    fetchKeys();
  }, []);

  // ── State ─────────────────────────────────────────────────────────────────
  const [matchState, setMatchState] = useState<MatchState>(() => engineRef.current!.getState());
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userTeam, setUserTeam] = useState<Team>('red');
  const [agentView, setAgentView] = useState<AgentView>('agents');
  const [stakedAmount, setStakedAmount] = useState<number | null>(null);
  const [stakedTeam, setStakedTeam] = useState<Team | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bottomView, setBottomView] = useState<'chat' | 'grid'>('chat');
  const [agentKeys, setAgentKeys] = useState<{ red: string; blue: string }>({ red: '', blue: '' });

  // Persistent grid — always available, rotates through shapes each round
  const [persistentGrid, setPersistentGrid] = useState<GridEventState>(() => ({
    id: 1,
    grid: Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0)),
    targetShape: GRID_TARGETS[0] as number[][],
    startMs: 0,
    endMs: GRID_ROUND_DURATION_MS,
    pixelsLeft: { red: FREE_PIXELS_PER_EVENT, blue: FREE_PIXELS_PER_EVENT },
  }));

  // ── Game loop — 100 ms tick ───────────────────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current!;
    const id = setInterval(() => {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      const elapsed = Date.now() - startTimeRef.current;
      elapsedMsRef.current = elapsed;

      const ticked = engine.tick(elapsed);
      const snap = {
        status: ticked.status,
        elapsedMs: ticked.elapsedMs,
        stakingOpen: ticked.stakingOpen,
        score: { ...ticked.score },
        agents: {
          red: { ...ticked.agents.red, stats: { ...ticked.agents.red.stats } },
          blue: { ...ticked.agents.blue, stats: { ...ticked.agents.blue.stats } },
        },
        ge: ticked.currentGridEvent,
      };

      setMatchState((prev) => ({
        status: snap.status,
        elapsedMs: snap.elapsedMs,
        stakingOpen: snap.stakingOpen,
        score: snap.score,
        agents: snap.agents,
        currentGridEvent:
          snap.ge === null
            ? null
            : {
                ...snap.ge,
                grid:
                  prev.currentGridEvent?.id === snap.ge.id
                    ? prev.currentGridEvent.grid
                    : snap.ge.grid,
                pixelsLeft:
                  prev.currentGridEvent?.id === snap.ge.id
                    ? prev.currentGridEvent.pixelsLeft
                    : snap.ge.pixelsLeft,
              },
      }));

      if (snap.status === 'active' && elapsed - lastSimRef.current >= 30_000) {
        lastSimRef.current = elapsed;
        const simTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
        const amount = Math.round((0.05 + Math.random() * 0.1) * 100) / 100;
        const entries = engine.applyAgentFunding(simTeam, amount);
        setDecisionLog((prev) => [...prev, ...entries].slice(-100));
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Poll real USDC balances every 15 s during active match ───────────────
  useEffect(() => {
    if (matchState.status !== 'active') return;
    const id = setInterval(async () => {
      try {
        const [red, blue] = await Promise.all([
          fetch('/api/agent/balance?agentId=red').then((r) => r.json()),
          fetch('/api/agent/balance?agentId=blue').then((r) => r.json()),
        ]);
        setMatchState((prev) => {
          if (
            prev.agents.red.usdcReceived === (red.balance ?? 0) &&
            prev.agents.blue.usdcReceived === (blue.balance ?? 0)
          )
            return prev;
          return {
            ...prev,
            agents: {
              red: { ...prev.agents.red, usdcReceived: red.balance ?? prev.agents.red.usdcReceived },
              blue: {
                ...prev.agents.blue,
                usdcReceived: blue.balance ?? prev.agents.blue.usdcReceived,
              },
            },
          };
        });
      } catch {
        // non-critical — silently ignore
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [matchState.status]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFeedEntry = useCallback((entry: FeedEntry) => {
    setFeedEntries((prev) => [...prev, entry].slice(-30));
  }, []);

  const handleGoal = useCallback((team: Team) => {
    engineRef.current!.processGoal(team);
    setMatchState((prev) => ({
      ...prev,
      score: { ...prev.score, [team]: prev.score[team] + 1 },
    }));
  }, []);

  const handleFundAgent = useCallback((team: Team, amount: number) => {
    const entries = engineRef.current!.applyAgentFunding(team, amount);
    setDecisionLog((prev) => [...prev, ...entries].slice(-100));
  }, []);

  const handleLogEntries = useCallback((entries: DecisionLogEntry[]) => {
    setDecisionLog((prev) => [...prev, ...entries].slice(-100));
  }, []);

  const handlePaintPixel = useCallback(
    (row: number, col: number) => {
      setPersistentGrid((prev) => {
        if (prev.pixelsLeft[userTeam] <= 0) return prev;
        const cellVal = userTeam === 'red' ? 1 : 2;
        if (prev.grid[row][col] === cellVal) return prev;
        return {
          ...prev,
          grid: prev.grid.map((r, ri) =>
            r.map((cell, ci) => (ri === row && ci === col ? cellVal : cell)),
          ),
          pixelsLeft: { ...prev.pixelsLeft, [userTeam]: prev.pixelsLeft[userTeam] - 1 },
        };
      });
    },
    [userTeam],
  );

  const handleBuyPixels = useCallback(
    (count: number) => {
      setPersistentGrid((prev) => ({
        ...prev,
        pixelsLeft: { ...prev.pixelsLeft, [userTeam]: prev.pixelsLeft[userTeam] + count },
      }));
    },
    [userTeam],
  );

  const addNotification = useCallback((type: 'tx' | 'round', msg?: string, duration = 3000) => {
    const id = String(++notifSeq);
    setNotifications((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), duration);
  }, []);

  const handleToast = useCallback(() => addNotification('tx'), [addNotification]);

  const dismissNotif = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleEventEnd = useCallback(
    (winner: Team | 'tie') => {
      if (winner !== 'tie') engineRef.current!.applyGridEventResult(winner);

      const roundMsg =
        winner === 'tie'
          ? 'Round draw · no boost applied'
          : `${winner === 'red' ? 'Red' : 'Blue'} wins the round · ×1.5 boost applied`;

      // System message visible in Chat tab
      setChatMessages((prev) =>
        [
          ...prev,
          {
            id: String(++chatSeq),
            team: winner === 'tie' ? 'red' : winner,
            emoji: '',
            sentAt: Date.now(),
            sender: 'system',
            type: 'system' as const,
            msg: roundMsg,
          },
        ].slice(-20),
      );

      // Global notification visible regardless of active tab
      addNotification('round', roundMsg, 4000);

      // Advance to next shape
      setPersistentGrid((prev) => {
        const nextId = (prev.id % GRID_TARGETS.length) + 1;
        const nowMs = elapsedMsRef.current;
        return {
          id: nextId,
          grid: Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0)),
          targetShape: GRID_TARGETS[nextId - 1] as number[][],
          startMs: nowMs,
          endMs: nowMs + GRID_ROUND_DURATION_MS,
          pixelsLeft: { red: FREE_PIXELS_PER_EVENT, blue: FREE_PIXELS_PER_EVENT },
        };
      });
    },
    [addNotification],
  );

  const handleEmojiSend = useCallback(
    (emoji: string) => {
      const sender =
        isAuthenticated && walletAddress
          ? `${walletAddress.slice(0, 4)}..${walletAddress.slice(-2)}`
          : myWalletId.current;
      setChatMessages((prev) =>
        [
          ...prev,
          { id: String(++chatSeq), team: userTeam, emoji, sentAt: Date.now(), sender },
        ].slice(-20),
      );
    },
    [userTeam, isAuthenticated, walletAddress],
  );

  const handleStake = useCallback((team: Team, amount: number) => {
    setStakedTeam((prev) => prev ?? team);
    setStakedAmount((prev) => (prev ?? 0) + amount);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isGrid = matchState.status === 'grid_event';
  const score = matchState.score;
  const timer = formatTimer(matchState.elapsedMs);

  // suppress unused var warnings for external integrations
  void roomId;
  void username;

  async function handleBeforeGift(
    _giftSlug: string,
    quantity: number,
    priceAmount: string,
    _priceAsset: string,
  ): Promise<{ txHash?: string } | false> {
    if (!recipientWallet) return false;
    const amount = (parseFloat(priceAmount) * quantity).toFixed(7);
    const issuer = USDC_ISSUER[network] ?? USDC_ISSUER.testnet;
    const client = getClient();
    try {
      await client.buildTx('payment', {
        destination: recipientWallet,
        amount,
        asset: { type: 'credit_alphanum4', code: 'USDC', issuer },
      });
      const built = client.getTransactionState();
      if (!built || built.step !== 'built') return false;
      await client.signAndSubmitTx(built.buildData.unsignedXdr);
      const final = client.getTransactionState();
      if (!final || final.step !== 'success') return false;
      return { txHash: final.hash };
    } catch (err) {
      console.error('Gift payment failed', err);
      return false;
    }
  }

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
        <TeamToggle value={userTeam} onChange={setUserTeam} />

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
            <span style={{ color: 'var(--red)' }}>{score.red}</span>
            <span style={{ color: 'var(--text-dim)' }}>:</span>
            <span style={{ color: 'var(--blue)' }}>{score.blue}</span>
          </div>
        </div>

        <WalletButton />
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column (65%) */}
        <div
          className="flex flex-col overflow-hidden border-r"
          style={{ flex: '65 65 0%', borderColor: 'var(--border)' }}
        >
          <div className="flex-1 overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
            <MatchCanvas
              matchState={matchState}
              onGoal={handleGoal}
              onFeedEntry={handleFeedEntry}
            />
          </div>

          {/* Bottom panel: Chat / Grid toggle */}
          <div className="flex shrink-0 flex-col overflow-hidden" style={{ height: 290 }}>
            {/* Tab bar */}
            <div
              className="flex shrink-0 border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}
            >
              {(['chat', 'grid'] as const).map((v) => {
                const active = bottomView === v;
                const accentColor = userTeam === 'red' ? 'var(--red)' : 'var(--blue)';
                return (
                  <button
                    key={v}
                    onClick={() => setBottomView(v)}
                    className="relative px-4 py-2 text-[10px] uppercase tracking-widest transition-colors"
                    style={{
                      fontFamily: 'var(--font-space-mono)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {v === 'chat' ? 'Chat' : 'Grid'}
                    {active && (
                      <motion.div
                        layoutId="bottom-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-[2px]"
                        style={{ background: accentColor }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="relative flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {bottomView === 'chat' ? (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0"
                  >
                    <div className="relative">
                      <GiftOverlay
                        roomId={roomId}
                        walletAddress={walletAddress}
                        apiBaseUrl={CHAT_API}
                      />
                      <LiveChat
                        roomId={roomId}
                        walletAddress={walletAddress}
                        username={username}
                        role="VIEWER"
                        apiBaseUrl={CHAT_API}
                        height={200}
                        onBeforeGift={handleBeforeGift}
                        className="fan-chat"
                      />
                    </div>
                    {/*<EmojiChat*/}
                    {/*  team={userTeam}*/}
                    {/*  messages={chatMessages.filter(m => m.team === userTeam || m.type === 'system')}*/}
                    {/*  onEmojiSend={handleEmojiSend}*/}
                    {/*  isVisible*/}
                    {/*/>*/}
                  </motion.div>
                ) : (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0"
                  >
                    <GridEvent
                      gridEvent={persistentGrid}
                      elapsedMs={matchState.elapsedMs}
                      team={userTeam}
                      onPaintPixel={handlePaintPixel}
                      onBuyPixels={handleBuyPixels}
                      onEventEnd={handleEventEnd}
                      onToast={handleToast}
                      hideHeader
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right column (35%) */}
        <div className="flex flex-col overflow-hidden" style={{ flex: '35 35 0%' }}>
          <div
            className="shrink-0 border-b"
            style={{ borderColor: 'var(--border)', height: agentView === 'agents' ? 360 : 'auto' }}
          >
            <AgentPanel
              agents={matchState.agents}
              userTeam={userTeam}
              isGridEvent={isGrid}
              activeView={agentView}
              onViewChange={setAgentView}
              onFundAgent={handleFundAgent}
              walletAddress={walletAddress}
              getClient={getClient}
              agentPublicKey={agentKeys[userTeam]}
              onLogEntries={handleLogEntries}
            />
          </div>

          {agentView === 'agents' && (
            <div className="flex-1 overflow-hidden">
              <AgentDecisionLog entries={decisionLog} activeTab={userTeam} />
            </div>
          )}

          {agentView === 'support' && (
            <StakePanel
              userTeam={userTeam}
              elapsedMs={matchState.elapsedMs}
              stakingOpen={matchState.stakingOpen}
              stakedAmount={stakedAmount}
              stakedTeam={stakedTeam}
              matchStatus={matchState.status}
              score={matchState.score}
              feedEntries={feedEntries}
              onStake={handleStake}
            />
          )}
        </div>
      </div>

      {/* ── Global notifications (top-right) ────────────────────────── */}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col items-end gap-2">
        <AnimatePresence>
          {notifications.map((notif, i) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 24, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="pointer-events-auto flex items-center gap-2 rounded border px-3 py-2 shadow-lg"
              style={{
                ...MONO_FONT,
                fontSize: 10,
                background: 'var(--bg-panel)',
                borderColor: notif.type === 'round' ? 'var(--gold)' : TX_GREEN,
                color: 'var(--text-muted)',
                transformOrigin: 'right center',
                transform: `scale(${1 - (notifications.length - 1 - i) * 0.025})`,
              }}
            >
              {notif.type === 'round' ? (
                <>
                  <span style={{ color: 'var(--gold)' }}>★</span>
                  <span style={{ color: 'var(--gold)' }}>{notif.msg}</span>
                </>
              ) : (
                <>
                  <span style={{ color: TX_GREEN }}>✓</span>
                  <span>
                    tx confirmed · <span style={{ color: TX_GREEN }}>0.01 USDC</span> · testnet
                  </span>
                </>
              )}
              <button
                onClick={() => dismissNotif(notif.id)}
                className="ml-2 flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color =
                    notif.type === 'round' ? 'var(--gold)' : TX_GREEN;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)';
                }}
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
