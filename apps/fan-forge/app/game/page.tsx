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
import { useMatchFocus } from '@/lib/hooks/useMatchFocus';
import type { DecisionLogEntry, GridEventState, MatchState, Team } from '@/lib/types';
import { GiftOverlay, LiveChat } from '@fan-match/live-chat';
import { usePollar, WalletButton } from '@pollar/react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
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
  const myWalletId = useRef<string>(makeWalletId());
  const elapsedMsRef = useRef<number>(0); // always-fresh elapsed for callbacks
  const thinkingRef = useRef<{ red: boolean; blue: boolean }>({ red: false, blue: false });
  const thinkAgentIndexRef = useRef<number>(0); // alternates red/blue
  // Tracks USDC already committed to upgrades this session
  const agentSpentRef = useRef<{ red: number; blue: number }>({ red: 0, blue: 0 });
  // Last usdcReceived seen — used to detect incoming funds
  const lastBalanceRef = useRef<{ red: number; blue: number }>({ red: 0, blue: 0 });
  const [agentNeedsFunds, setAgentNeedsFunds] = useState<{ red: boolean; blue: boolean }>({
    red: false,
    blue: false,
  });
  // Mirror of matchState for use inside callbacks without stale closures
  const matchStateRef = useRef<MatchState | null>(null);

  // ── Role focus (drives canvas highlight + stat row) ──────────────────────
  const { focusedRole, toggleRole } = useMatchFocus();

  if (!engineRef.current) {
    engineRef.current = new GameEngine('GAGENTR3DXYZ', 'GAGENTB7WXYZ');
  }

  // ── External integrations (Pollar / search params) ────────────────────────
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId') ?? '';
  const recipientWallet = searchParams.get('ownerWallet') ?? '';
  const { walletAddress, getClient, isAuthenticated, network } = usePollar();

  const [roomIds, setRoomIds] = useState<{ red: string; blue: string }>({ red: '', blue: '' });
  const [username, setUsername] = useState('');
  const [matchStarted, setMatchStarted] = useState(false);
  const matchStartedRef = useRef(false);
  // Set to true once the initial match fetch resolves — prevents the start
  // modal from flashing on refresh when the match is already active.
  const matchDataLoadedRef = useRef(false);

  // Fetch match state on mount — restore timer, score, and agent stats
  useEffect(() => {
    if (!matchId) return;
    fetch(`/api/matches/${matchId}`)
      .then((r) => r.json())
      .then(
        (match: {
          startedAt?: string | null;
          scoreRed?: number;
          scoreBlue?: number;
          data?: {
            agentStats?: {
              red?: Partial<import('@/lib/types').AgentStats>;
              blue?: Partial<import('@/lib/types').AgentStats>;
            };
            decisionLog?: DecisionLogEntry[];
          } | null;
        }) => {
          if (match.startedAt) {
            const serverStart = new Date(match.startedAt).getTime();
            startTimeRef.current = serverStart;
            matchStartedRef.current = true;
            setMatchStarted(true);
          }
          const red = match.scoreRed ?? 0;
          const blue = match.scoreBlue ?? 0;
          if (red > 0 || blue > 0) {
            engineRef.current!.setScore(red, blue);
          }
          // Restore agent stats saved during the match
          const savedStats = match.data?.agentStats;
          if (savedStats?.red) engineRef.current!.setAgentStats('red', savedStats.red);
          if (savedStats?.blue) engineRef.current!.setAgentStats('blue', savedStats.blue);

          // Restore decision log
          const savedLog = match.data?.decisionLog;
          if (savedLog && savedLog.length > 0) {
            setDecisionLog(savedLog.slice(-100));
          }

          // Sync engine state into React state in one shot
          const engineState = engineRef.current!.getState();
          setMatchState((prev) => ({
            ...prev,
            score: { red, blue },
            agents: {
              red: { ...prev.agents.red, stats: { ...engineState.agents.red.stats } },
              blue: { ...prev.agents.blue, stats: { ...engineState.agents.blue.stats } },
            },
          }));

          // Mark data as loaded — used by the wallet-ready effect below.
          matchDataLoadedRef.current = true;

          // Show start modal only when the match hasn't started yet.
          // Doing it here (after the fetch) ensures we have the real server
          // state — no false-positive from matchStarted=false on initial render.
          if (!match.startedAt) {
            const wallet = walletAddress;
            const owner = recipientWallet;
            if (wallet && owner && wallet === owner) {
              setShowStartModal(true);
            }
          }
        },
      )
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    fetch(`/api/matches/${matchId}/room`, { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.roomIdRed && data.roomIdBlue) {
          setRoomIds({ red: data.roomIdRed, blue: data.roomIdBlue });
        }
      })
      .catch(console.error);
  }, [matchId]);

  // Fallback: if the wallet authenticated after the match fetch already ran,
  // show the start modal now (only if the match hasn't started yet).
  useEffect(() => {
    if (!isAuthenticated || !walletAddress || !recipientWallet) return;
    if (!matchDataLoadedRef.current) return;   // fetch hasn't resolved yet — it will handle it
    if (matchStartedRef.current) return;       // match already running — never show
    if (walletAddress === recipientWallet) {
      setShowStartModal(true);
    }
  }, [isAuthenticated, walletAddress, recipientWallet]);

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
  const teamParam = searchParams.get('team') as Team | null;
  const [userTeam, setUserTeam] = useState<Team>(teamParam === 'blue' ? 'blue' : 'red');
  const [agentView, setAgentView] = useState<AgentView>('agents');
  const [stakedAmount, setStakedAmount] = useState<number | null>(null);
  const [stakedTeam, setStakedTeam] = useState<Team | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bottomView, setBottomView] = useState<'chat' | 'grid'>('chat');
  const [agentKeys, setAgentKeys] = useState<{ red: string; blue: string }>({ red: '', blue: '' });
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const prevStatusRef = useRef<string>('');

  // Persistent grid — always available, rotates through shapes each round
  const [persistentGrid, setPersistentGrid] = useState<GridEventState>(() => ({
    id: 1,
    grid: Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0)),
    targetShape: GRID_TARGETS[0] as number[][],
    startMs: 0,
    endMs: GRID_ROUND_DURATION_MS,
    pixelsLeft: { red: FREE_PIXELS_PER_EVENT, blue: FREE_PIXELS_PER_EVENT },
  }));

  // Keep matchStateRef in sync so callbacks always read the latest balance
  useEffect(() => {
    matchStateRef.current = matchState;
  }, [matchState]);

  // Show finish modal when match transitions to finished
  useEffect(() => {
    if (
      matchState.status === 'finished' &&
      prevStatusRef.current !== 'finished' &&
      prevStatusRef.current !== ''
    ) {
      setShowFinishModal(true);
    }
    prevStatusRef.current = matchState.status;
  }, [matchState.status]);

  // ── Game loop — 100 ms tick ───────────────────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current!;
    const id = setInterval(() => {
      if (!matchStartedRef.current) return;
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
        // Preserve usdcReceived from Horizon polling — engine always has 0
        agents: {
          red: { ...snap.agents.red, usdcReceived: prev.agents.red.usdcReceived },
          blue: { ...snap.agents.blue, usdcReceived: prev.agents.blue.usdcReceived },
        },
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

      // (autonomous thinking handled by separate useEffect below)
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Poll real USDC balances — immediately on match start, then every 15s ──
  useEffect(() => {
    if (matchState.status !== 'active') return;

    async function fetchBalances() {
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
              red: {
                ...prev.agents.red,
                usdcReceived: red.balance ?? prev.agents.red.usdcReceived,
              },
              blue: {
                ...prev.agents.blue,
                usdcReceived: blue.balance ?? prev.agents.blue.usdcReceived,
              },
            },
          };
        });
      } catch {
        // non-critical
      }
    }

    fetchBalances(); // immediate on match start — no waiting
    const id = setInterval(fetchBalances, 15_000);
    return () => clearInterval(id);
  }, [matchState.status]);

  // ── Shared agent think/spend function ─────────────────────────────────────
  const runAgentThink = useCallback(async (team: Team) => {
    if (!matchStartedRef.current) return;
    const elapsed = elapsedMsRef.current;
    if (elapsed >= MATCH_DURATION_MS) return;
    if (thinkingRef.current[team]) return;

    thinkingRef.current[team] = true;
    try {
      const state = engineRef.current!.getState();
      // Use matchStateRef for balance — it reflects the real Horizon balance
      // whereas engine.usdcReceived starts at 0 and only tracks local changes
      const usdcReceived =
        matchStateRef.current?.agents[team].usdcReceived ?? state.agents[team].usdcReceived;
      const availableUsdc = Math.max(0, usdcReceived - agentSpentRef.current[team]);

      const res = await fetch('/api/agent/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: team,
          score: state.score,
          elapsedMs: elapsed,
          stats: state.agents[team].stats,
          usdcReceived,
          availableUsdc,
        }),
      });

      if (!res.ok) return;

      const data = (await res.json()) as {
        logEntries?: import('@/lib/types').DecisionLogEntry[];
        upgrade?: { stat: keyof import('@/lib/types').AgentStats; amount: number; cost: number };
        needsFunds?: boolean;
        nextUpgradeCost?: number;
      };

      if (data.logEntries?.length) {
        setDecisionLog((prev) => [...prev, ...data.logEntries!].slice(-100));
      }

      // Update "needs funds" badge in panel
      setAgentNeedsFunds((prev) => ({
        ...prev,
        [team]: data.needsFunds ?? false,
      }));

      if (data.upgrade) {
        agentSpentRef.current[team] += data.upgrade.cost;
        engineRef.current!.applyStatUpgrade(
          team,
          data.upgrade.stat,
          data.upgrade.amount,
          data.upgrade.cost,
        );
        const updatedStats = engineRef.current!.getState().agents[team].stats;
        // Only update stats — usdcReceived comes from Horizon polling, not the engine
        setMatchState((prev) => ({
          ...prev,
          agents: {
            ...prev.agents,
            [team]: {
              ...prev.agents[team],
              stats: { ...updatedStats },
            },
          },
        }));
        setAgentNeedsFunds((prev) => ({ ...prev, [team]: false }));

        // Persist latest agent stats to the match record
        if (matchId) {
          const opponent: Team = team === 'red' ? 'blue' : 'red';
          const opponentStats = engineRef.current!.getState().agents[opponent].stats;
          fetch(`/api/matches/${matchId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: {
                agentStats: {
                  [team]: updatedStats,
                  [opponent]: opponentStats,
                },
                lastUpgrade: {
                  team,
                  stat: data.upgrade.stat,
                  amount: data.upgrade.amount,
                  cost: data.upgrade.cost,
                  elapsedMs: elapsedMsRef.current,
                },
              },
            }),
          }).catch(() => {
            /* non-critical */
          });
        }

        // Chain: if still has funds, upgrade again after a short pause for UI animation
        const stillAvailable =
          (matchStateRef.current?.agents[team].usdcReceived ?? 0) - agentSpentRef.current[team];
        if (stillAvailable >= 0.05) {
          setTimeout(() => void runAgentThink(team), 1500);
        }
      }
    } catch {
      // non-critical
    } finally {
      thinkingRef.current[team] = false;
    }
  }, []);

  // ── React immediately when an agent receives new funds ────────────────────
  useEffect(() => {
    if (!matchStartedRef.current) return;
    for (const team of ['red', 'blue'] as Team[]) {
      const current = matchState.agents[team].usdcReceived;
      if (current > lastBalanceRef.current[team]) {
        lastBalanceRef.current[team] = current;
        // New USDC detected — think/act right away
        void runAgentThink(team);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState.agents.red.usdcReceived, matchState.agents.blue.usdcReceived]);

  // ── Periodic thinking loop (idle thoughts, alternates red/blue) ──────────
  useEffect(() => {
    const id = setInterval(() => {
      const team: Team = thinkAgentIndexRef.current % 2 === 0 ? 'red' : 'blue';
      thinkAgentIndexRef.current += 1;
      // Only fire if agent isn't already mid-chain (thinkingRef guard handles duplicates)
      void runAgentThink(team);
    }, 30_000); // 30s — each agent gets a pulse every 60s when idle
    return () => clearInterval(id);
  }, [runAgentThink]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFeedEntry = useCallback((entry: FeedEntry) => {
    setFeedEntries((prev) => [...prev, entry].slice(-30));
  }, []);

  const handleGoal = useCallback(
    (team: Team) => {
      engineRef.current!.processGoal(team);
      setMatchState((prev) => {
        const newScore = { ...prev.score, [team]: prev.score[team] + 1 };
        fetch(`/api/matches/${matchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scoreRed: newScore.red, scoreBlue: newScore.blue }),
        }).catch(console.error);
        return { ...prev, score: newScore };
      });
    },
    [matchId],
  );

  const handleFundAgent = useCallback((team: Team, amount: number) => {
    const entries = engineRef.current!.applyAgentFunding(team, amount);
    setDecisionLog((prev) => [...prev, ...entries].slice(-100));
  }, []);

  const handleLogEntries = useCallback((entries: DecisionLogEntry[]) => {
    setDecisionLog((prev) => [...prev, ...entries].slice(-100));
  }, []);

  // Persist the full decision log to DB whenever it changes.
  // Using a ref to skip the initial empty render (before the match data is restored).
  const decisionLogInitRef = useRef(false);
  useEffect(() => {
    if (!matchId || !decisionLogInitRef.current) {
      decisionLogInitRef.current = true;
      return;
    }
    if (decisionLog.length === 0) return;
    fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { decisionLog } }),
    }).catch(console.error);
  }, [decisionLog, matchId]);

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

  const handleStartMatch = useCallback(() => {
    const now = Date.now();
    matchStartedRef.current = true;
    startTimeRef.current = now;
    setMatchStarted(true);
    // Persist start time so late joiners / refreshes sync to the same clock
    fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startedAt: now }),
    }).catch(console.error);
  }, [matchId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isGrid = matchState.status === 'grid_event';
  const score = matchState.score;
  const timer = formatTimer(matchState.elapsedMs);
  const roomId = roomIds[userTeam];
  const isOwner = isAuthenticated && !!walletAddress && walletAddress === recipientWallet;


  // suppress unused var warning for external integration
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

  // console.log({ matchStarted, isOwner });
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
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-colors"
            style={{
              fontFamily: 'var(--font-space-mono)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)')
            }
          >
            ← Matches
          </Link>
          <TeamToggle value={userTeam} onChange={setUserTeam} />
        </div>

        <div className="flex items-center gap-4">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded"
            style={{
              fontFamily: 'var(--font-space-mono)',
              ...(matchState.status === 'finished'
                ? { background: '#ffffff0a', color: '#666', border: '1px solid #333' }
                : matchStarted
                  ? { background: '#00ff8822', color: '#00ff88', border: '1px solid #00ff8855' }
                  : { background: '#ffffff12', color: '#888', border: '1px solid #444' }),
            }}
          >
            {matchState.status === 'finished'
              ? '■ finished'
              : matchStarted
                ? '● live'
                : '○ waiting'}
          </span>
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
          <div
            className="relative flex-1 overflow-hidden border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <GiftOverlay roomId={roomId} walletAddress={walletAddress} apiBaseUrl={CHAT_API} />
            <div className="absolute inset-0">
              <MatchCanvas
                matchState={matchState}
                onGoal={handleGoal}
                onFeedEntry={handleFeedEntry}
                paused={!matchStarted || matchState.status === 'finished'}
                focusedRole={focusedRole}
              />
            </div>
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
                    <div className="relative" style={{ height: '100%' }}>
                      <LiveChat
                        roomId={roomId}
                        walletAddress={walletAddress}
                        username={username}
                        role="VIEWER"
                        apiBaseUrl={CHAT_API}
                        height="100%"
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
            style={{ borderColor: 'var(--border)', height: agentView === 'agents' ? 440 : 'auto' }}
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
              matchStarted={matchStarted && matchState.status !== 'finished'}
              needsFunds={agentNeedsFunds[userTeam]}
              focusedRole={focusedRole}
              onFocusRole={toggleRole}
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

      {/* ── Match start modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showStartModal && (
          <motion.div
            key="start-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col items-center gap-6 rounded-xl border p-10"
              style={{
                ...MONO_FONT,
                background: 'var(--bg-panel)',
                borderColor: 'var(--border-accent)',
                minWidth: 340,
                boxShadow: '0 0 60px rgba(0,0,0,0.6)',
              }}
            >
              {/* Label */}
              <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                Ready to kick off
              </div>

              {/* Teams */}
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold" style={{ color: 'var(--red)' }}>RED</span>
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--red)', opacity: 0.6 }}>Agent Red</span>
                </div>
                <span className="text-xl font-bold" style={{ color: 'var(--text-dim)' }}>VS</span>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold" style={{ color: 'var(--blue)' }}>BLUE</span>
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--blue)', opacity: 0.6 }}>Agent Blue</span>
                </div>
              </div>

              {/* Duration hint */}
              <div
                className="px-4 py-1.5 rounded text-[11px] uppercase tracking-widest"
                style={{
                  background: '#ffffff08',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                5:00 · 3 grid events · live staking
              </div>

              {/* Start button */}
              <button
                onClick={() => {
                  setShowStartModal(false);
                  handleStartMatch();
                }}
                className="w-full rounded px-6 py-3 text-[11px] font-bold uppercase tracking-widest transition-all"
                style={{
                  background: 'var(--blue)',
                  color: '#0a0a0f',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 0 24px rgba(77,159,255,0.35)',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
              >
                ▶ Start Match
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Match finish modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showFinishModal &&
          (() => {
            const winner: Team | 'tie' =
              score.red > score.blue ? 'red' : score.blue > score.red ? 'blue' : 'tie';
            const userWon = stakedTeam !== null && winner !== 'tie' && stakedTeam === winner;
            const userLost = stakedTeam !== null && winner !== 'tie' && stakedTeam !== winner;

            return (
              <motion.div
                key="finish-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 z-[100] flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 16 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex flex-col items-center gap-6 rounded-xl border p-10"
                  style={{
                    ...MONO_FONT,
                    background: 'var(--bg-panel)',
                    borderColor: 'var(--border-accent)',
                    minWidth: 340,
                    boxShadow: '0 0 60px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Title */}
                  <div
                    className="text-[11px] uppercase tracking-[0.2em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Match Finished
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-5xl font-bold" style={{ color: 'var(--red)' }}>
                        {score.red}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: 'var(--red)', opacity: 0.7 }}
                      >
                        Red
                      </span>
                    </div>
                    <span className="text-3xl font-bold" style={{ color: 'var(--text-dim)' }}>
                      :
                    </span>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-5xl font-bold" style={{ color: 'var(--blue)' }}>
                        {score.blue}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: 'var(--blue)', opacity: 0.7 }}
                      >
                        Blue
                      </span>
                    </div>
                  </div>

                  {/* Winner label */}
                  <div
                    className="px-4 py-1.5 rounded text-[11px] font-bold uppercase tracking-widest"
                    style={{
                      background:
                        winner === 'tie'
                          ? '#ffffff0a'
                          : winner === 'red'
                            ? 'rgba(255,60,80,0.15)'
                            : 'rgba(77,159,255,0.15)',
                      color:
                        winner === 'tie'
                          ? 'var(--text-muted)'
                          : winner === 'red'
                            ? 'var(--red)'
                            : 'var(--blue)',
                      border: `1px solid ${winner === 'tie' ? 'var(--border)' : winner === 'red' ? 'rgba(255,60,80,0.35)' : 'rgba(77,159,255,0.35)'}`,
                    }}
                  >
                    {winner === 'tie' ? 'Draw' : `${winner === 'red' ? 'Red' : 'Blue'} wins`}
                  </div>

                  {/* Stake result */}
                  {stakedAmount !== null && stakedTeam !== null && (
                    <div
                      className="w-full rounded border px-4 py-3 text-center text-[11px]"
                      style={{
                        background: userWon
                          ? 'rgba(0,255,136,0.06)'
                          : userLost
                            ? 'rgba(255,60,80,0.06)'
                            : '#ffffff08',
                        borderColor: userWon
                          ? 'rgba(0,255,136,0.25)'
                          : userLost
                            ? 'rgba(255,60,80,0.25)'
                            : 'var(--border)',
                        color: userWon ? '#00ff88' : userLost ? 'var(--red)' : 'var(--text-muted)',
                      }}
                    >
                      {userWon && (
                        <>
                          <div className="text-base font-bold mb-0.5">You won!</div>
                          <div style={{ opacity: 0.8 }}>
                            Staked {stakedAmount.toFixed(2)} USDC on {stakedTeam} · payout incoming
                          </div>
                        </>
                      )}
                      {userLost && (
                        <>
                          <div className="text-base font-bold mb-0.5">You lost</div>
                          <div style={{ opacity: 0.8 }}>
                            -{stakedAmount.toFixed(2)} USDC · staked on {stakedTeam}
                          </div>
                        </>
                      )}
                      {winner === 'tie' && (
                        <>
                          <div className="text-base font-bold mb-0.5">Draw</div>
                          <div style={{ opacity: 0.8 }}>
                            Your {stakedAmount.toFixed(2)} USDC stake will be refunded
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Back to matches */}
                  <Link
                    href="/"
                    className="w-full rounded px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest transition-all"
                    style={{
                      background: 'var(--blue)',
                      color: '#0a0a0f',
                      textDecoration: 'none',
                      display: 'block',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.opacity = '0.85')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.opacity = '1')
                    }
                  >
                    ← Back to Matches
                  </Link>
                </motion.div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

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
