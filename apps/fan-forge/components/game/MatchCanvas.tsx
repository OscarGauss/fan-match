'use client';

import { useRef, useEffect, useState } from 'react';
import type { MatchState, Team, AgentStats } from '@/lib/types';
import type { FocusedRole } from '@/lib/hooks/useMatchFocus';

// ── Public types ──────────────────────────────────────────────────────────────

export interface FeedEntry {
  id: number;
  elapsedMs: number;
  team: Team | null;
  message: string;
}

export interface MatchCanvasProps {
  matchState: MatchState;
  onGoal: (team: Team) => void;
  onFeedEntry?: (entry: FeedEntry) => void;
  paused?: boolean;
  focusedRole?: FocusedRole;
}

// ── Rod layout (left = red goal → right = blue goal) ─────────────────────────

interface RodDef {
  xFrac: number;
  team: Team;
  role: keyof AgentStats;
  count: number;
}

const ROD_DEFS: RodDef[] = [
  { xFrac: 0.06, team: 'red', role: 'goalkeeper', count: 1 },
  { xFrac: 0.21, team: 'blue', role: 'forward', count: 3 },
  { xFrac: 0.36, team: 'red', role: 'defense', count: 2 },
  { xFrac: 0.47, team: 'red', role: 'midfield', count: 3 },
  { xFrac: 0.53, team: 'blue', role: 'midfield', count: 3 },
  { xFrac: 0.64, team: 'blue', role: 'defense', count: 2 },
  { xFrac: 0.79, team: 'red', role: 'forward', count: 3 },
  { xFrac: 0.94, team: 'blue', role: 'goalkeeper', count: 1 },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_H = 360;
const FIELD_PAD_X = 40;
const FIELD_PAD_Y = 20;
const GOAL_DEPTH = 18;
const GOAL_H_FRAC = 0.38;
const BALL_R = 5;
const BALL_SPEED = 195;
const BALL_MAX_SPD = 460;
const BOUNCE_BOOST = 1.06;
const GOAL_COOLDOWN = 1300; // ms
const BASE_ROD_SPD = 185; // px/s at stat 50
const BASE_PLR_RW = 7; // player ellipse half-width (base)
const BASE_PLR_RH = 4.5; // player ellipse half-height
// Width range: BASE_PLR_RW (stat=0) → BASE_PLR_RW * 2.2 (stat=100) — visually obvious
const PLR_RW_SCALE = BASE_PLR_RW * 1.2;
// Coordination drives all-rod speed: 0.6× at coord=0, 1.4× at coord=100
const COORD_SPD_MIN = 0.6;
const COORD_SPD_MAX = 1.4;

const FIELD_COLOR = '#0a2a14';
const STRIPE_COLOR = '#091f0f';
const LINE = 'rgba(255,255,255,0.5)';
const RED = '#ff4d4d';
const BLUE = '#4d9fff';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Vertical offsets for `count` players centred around y=0. */
function playerOffsets(count: number, fieldH: number): number[] {
  const spacing = fieldH / (count + 1);
  return Array.from({ length: count }, (_, j) => (j - (count - 1) / 2) * spacing);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchCanvas({ matchState, onGoal, onFeedEntry, paused = false, focusedRole = null }: MatchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number>(0);

  // Live prop refs — RAF loop reads these, never stale
  const msRef = useRef(matchState);
  const onGoalRef = useRef(onGoal);
  const onFeedRef = useRef(onFeedEntry);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const focusedRoleRef = useRef(focusedRole);
  useEffect(() => { focusedRoleRef.current = focusedRole; }, [focusedRole]);
  useEffect(() => {
    msRef.current = matchState;
  }, [matchState]);
  useEffect(() => {
    onGoalRef.current = onGoal;
  }, [onGoal]);
  useEffect(() => {
    onFeedRef.current = onFeedEntry;
  }, [onFeedEntry]);

  const dimsRef = useRef({ w: 800, h: CANVAS_H });
  const canvasHRef = useRef(CANVAS_H);

  // Physics (never triggers React re-render)
  const phys = useRef({
    bx: 400,
    by: CANVAS_H / 2,
    vx: BALL_SPEED,
    vy: BALL_SPEED * 0.4,
    rodY: ROD_DEFS.map(() => CANVAS_H / 2) as number[],
    flash: null as null | { team: Team; fa: number; ta: number },
    cooldown: 0,
  });

  // Feed (React state — drives DOM only)
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const feedIdRef = useRef(0);
  const feedCache = useRef<FeedEntry[]>([]);

  // Detect matchState changes → feed entries (upgrades, boosts, status)
  const prevMsRef = useRef(matchState);
  useEffect(() => {
    const prev = prevMsRef.current;
    const curr = matchState;
    const entries: FeedEntry[] = [];

    const push = (team: Team | null, msg: string) =>
      entries.push({ id: ++feedIdRef.current, elapsedMs: curr.elapsedMs, team, message: msg });

    for (const t of ['red', 'blue'] as Team[]) {
      const ps = prev.agents[t].stats;
      const cs = curr.agents[t].stats;
      for (const role of Object.keys(ps) as (keyof AgentStats)[]) {
        if (cs[role] !== ps[role])
          push(t, `${t === 'red' ? 'AgentRed' : 'AgentBlue'} upgraded ${role}`);
      }
      if (!prev.agents[t].activeBoost && curr.agents[t].activeBoost)
        push(t, `${t === 'red' ? 'AgentRed' : 'AgentBlue'} boost ×1.5`);
    }

    if (prev.status !== curr.status) {
      if (curr.status === 'grid_event')
        push(null, `Grid Event #${curr.currentGridEvent?.id ?? ''} started`);
      else if (prev.status === 'grid_event') push(null, 'Grid Event ended');
      else if (curr.status === 'finished') {
        const w =
          curr.score.red > curr.score.blue
            ? 'red'
            : curr.score.blue > curr.score.red
              ? 'blue'
              : null;
        push(
          null,
          w ? `Match over · ${w === 'red' ? 'AgentRed' : 'AgentBlue'} wins` : 'Match over · Draw',
        );
      }
    }

    if (entries.length) {
      entries.forEach((e) => onFeedRef.current?.(e));
      const next = [...entries, ...feedCache.current].slice(0, 8);
      feedCache.current = next;
      setFeed([...next]);
    }

    prevMsRef.current = curr;
  }, [matchState]);

  // RAF loop — runs once, reads everything from refs
  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext('2d')!;
    let dpr = window.devicePixelRatio || 1;
    let initialized = false;

    // ── Resize ────────────────────────────────────────────────────────────────

    function handleResize() {
      dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight || canvasHRef.current;
      canvasHRef.current = h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      dimsRef.current = { w, h };
      if (!initialized) {
        phys.current.bx = w / 2;
        phys.current.by = h / 2;
        phys.current.rodY = ROD_DEFS.map(() => h / 2);
        initialized = true;
      }
    }

    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    // ── Field rect ────────────────────────────────────────────────────────────

    function field() {
      const w = dimsRef.current.w;
      const h = canvasHRef.current;
      return {
        x: FIELD_PAD_X,
        y: FIELD_PAD_Y,
        w: w - FIELD_PAD_X * 2,
        h: h - FIELD_PAD_Y * 2,
      };
    }

    // ── Push feed entry (called from RAF) ─────────────────────────────────────

    function pushFeed(team: Team | null, msg: string) {
      const entry: FeedEntry = {
        id: ++feedIdRef.current,
        elapsedMs: msRef.current.elapsedMs,
        team,
        message: msg,
      };
      onFeedRef.current?.(entry);
      const next = [entry, ...feedCache.current].slice(0, 8);
      feedCache.current = next;
      setFeed([...next]);
    }

    // ── Reset ball to centre ──────────────────────────────────────────────────

    function resetBall() {
      const f = field();
      const sign = Math.random() < 0.5 ? 1 : -1;
      const aOff = (Math.random() * 40 - 20) * (Math.PI / 180);
      const base = sign > 0 ? 0 : Math.PI;
      phys.current.bx = f.x + f.w / 2;
      phys.current.by = f.y + f.h / 2;
      phys.current.vx = Math.cos(base + aOff) * BALL_SPEED;
      phys.current.vy = Math.sin(base + aOff) * BALL_SPEED;
    }

    // ── Draw helpers ──────────────────────────────────────────────────────────

    type Field = ReturnType<typeof field>;

    function drawField(f: Field) {
      const w = dimsRef.current.w;

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, canvasHRef.current);

      // Stripes
      const sw = f.w / 8;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? FIELD_COLOR : STRIPE_COLOR;
        ctx.fillRect(f.x + i * sw, f.y, sw, f.h);
      }

      // Field border
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(f.x, f.y, f.w, f.h);

      // Centre line
      ctx.beginPath();
      ctx.moveTo(f.x + f.w / 2, f.y);
      ctx.lineTo(f.x + f.w / 2, f.y + f.h);
      ctx.stroke();

      // Centre circle
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.h * 0.14, 0, Math.PI * 2);
      ctx.stroke();

      // Centre dot
      ctx.fillStyle = LINE;
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Penalty boxes
      const penW = f.w * 0.13;
      const penH = f.h * 0.52;
      const penY = f.y + (f.h - penH) / 2;
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(f.x, penY, penW, penH);
      ctx.strokeRect(f.x + f.w - penW, penY, penW, penH);

      // Goals
      const goalH = f.h * GOAL_H_FRAC;
      const goalY = f.y + (f.h - goalH) / 2;

      ctx.fillStyle = 'rgba(255,77,77,0.08)';
      ctx.fillRect(f.x - GOAL_DEPTH, goalY, GOAL_DEPTH, goalH);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(f.x - GOAL_DEPTH, goalY, GOAL_DEPTH, goalH);

      ctx.fillStyle = 'rgba(77,159,255,0.08)';
      ctx.fillRect(f.x + f.w, goalY, GOAL_DEPTH, goalH);
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(f.x + f.w, goalY, GOAL_DEPTH, goalH);
    }

    function drawRods(f: Field, ms: MatchState) {
      const focused = focusedRoleRef.current;
      ROD_DEFS.forEach((def, i) => {
        const rx = f.x + def.xFrac * f.w;
        const rodY = phys.current.rodY[i];
        const stat = ms.agents[def.team].stats[def.role];
        const tc = def.team === 'red' ? RED : BLUE;
        const boosted = ms.agents[def.team].activeBoost;
        const isFocused = focused === null || def.role === focused;
        const dimAlpha = isFocused ? 1 : 0.18;

        ctx.save();
        ctx.globalAlpha = dimAlpha;

        // Rod line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx, f.y);
        ctx.lineTo(rx, f.y + f.h);
        ctx.stroke();

        // Boost glow
        if (boosted) {
          ctx.strokeStyle = def.team === 'red' ? 'rgba(255,77,77,0.28)' : 'rgba(77,159,255,0.28)';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(rx, f.y);
          ctx.lineTo(rx, f.y + f.h);
          ctx.stroke();
        }

        // Focused role gets an extra highlight ring on the rod
        if (focused !== null && isFocused) {
          ctx.strokeStyle = def.team === 'red' ? 'rgba(255,77,77,0.55)' : 'rgba(77,159,255,0.55)';
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(rx, f.y);
          ctx.lineTo(rx, f.y + f.h);
          ctx.stroke();
        }

        // Players — width grows with the role's stat
        const offsets = playerOffsets(def.count, f.h);
        const rw = BASE_PLR_RW + (stat / 100) * PLR_RW_SCALE;

        offsets.forEach((off) => {
          const py = clamp(rodY + off, f.y + BASE_PLR_RH + 2, f.y + f.h - BASE_PLR_RH - 2);
          ctx.fillStyle = tc;
          ctx.shadowColor = tc;
          ctx.shadowBlur = focused !== null && isFocused ? 14 : 5;
          ctx.beginPath();
          ctx.ellipse(rx, py, rw, BASE_PLR_RH, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        });

        ctx.restore();
      });
    }

    function drawBall() {
      const { bx, by } = phys.current;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(bx + 2, by + 2, BALL_R, BALL_R * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ball
      ctx.shadowColor = 'rgba(255,255,255,0.5)';
      ctx.shadowBlur = 7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawFlash(f: Field) {
      const fl = phys.current.flash;
      if (!fl) return;
      const w = dimsRef.current.w;
      const c = fl.team === 'red' ? RED : BLUE;

      const hexA = Math.round(fl.fa * 50)
        .toString(16)
        .padStart(2, '0');
      ctx.fillStyle = `${c}${hexA}`;
      ctx.fillRect(0, 0, w, canvasHRef.current);

      if (fl.ta > 0) {
        ctx.save();
        ctx.globalAlpha = fl.ta;
        ctx.fillStyle = c;
        ctx.shadowColor = c;
        ctx.shadowBlur = 28;
        ctx.font = `900 ${Math.round(f.h * 0.3)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GOAL', f.x + f.w / 2, f.y + f.h / 2);
        ctx.restore();
      }
    }

    // ── Physics tick ──────────────────────────────────────────────────────────

    function tick(time: number) {
      const dt = Math.min((time - lastTRef.current) / 1000, 0.05);
      lastTRef.current = time;

      const p = phys.current;
      const ms = msRef.current;
      const f = field();

      // When paused, just draw the static field and schedule next frame
      if (pausedRef.current) {
        drawField(f);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (p.cooldown > 0) p.cooldown -= dt * 1000;

      // Rod tracking
      ROD_DEFS.forEach((def, i) => {
        const stat = ms.agents[def.team].stats[def.role];
        const coord = ms.agents[def.team].stats.speed;
        // Role stat → base tracking speed; speed → global speed multiplier
        const roleFactor = 0.28 + (stat / 100) * 0.72;
        const coordMult = COORD_SPD_MIN + (coord / 100) * (COORD_SPD_MAX - COORD_SPD_MIN);
        const speedFactor = roleFactor * coordMult;
        let targetY = p.by;
        if (def.role === 'defense') {
          targetY += (1 - speedFactor) * 18 * (Math.random() - 0.5);
        }

        const offsets = playerOffsets(def.count, f.h);
        const maxOff = offsets.length ? Math.max(...offsets.map(Math.abs)) : 0;
        const minY = f.y + maxOff + BASE_PLR_RH + 2;
        const maxY = f.y + f.h - maxOff - BASE_PLR_RH - 2;

        const spd = BASE_ROD_SPD * speedFactor;
        const diff = targetY - p.rodY[i];
        p.rodY[i] = clamp(
          p.rodY[i] + Math.sign(diff) * Math.min(Math.abs(diff), spd * dt),
          minY,
          maxY,
        );
      });

      // Ball movement
      p.bx += p.vx * dt;
      p.by += p.vy * dt;

      // Wall bounce
      if (p.by - BALL_R < f.y) {
        p.by = f.y + BALL_R;
        p.vy = Math.abs(p.vy);
      }
      if (p.by + BALL_R > f.y + f.h) {
        p.by = f.y + f.h - BALL_R;
        p.vy = -Math.abs(p.vy);
      }

      // Player collisions
      if (p.cooldown <= 0) {
        let hit = false;
        for (let i = 0; i < ROD_DEFS.length && !hit; i++) {
          const def = ROD_DEFS[i];
          const rx = f.x + def.xFrac * f.w;
          const stat = ms.agents[def.team].stats[def.role];
          const rw = BASE_PLR_RW + (stat / 100) * PLR_RW_SCALE;
          const boost = ms.agents[def.team].activeBoost ? 1.4 : 1;
          const offsets = playerOffsets(def.count, f.h);

          for (const off of offsets) {
            const py = clamp(p.rodY[i] + off, f.y + BASE_PLR_RH + 2, f.y + f.h - BASE_PLR_RH - 2);
            const dx = (p.bx - rx) / (rw + BALL_R);
            const dy = (p.by - py) / (BASE_PLR_RH + BALL_R);

            if (dx * dx + dy * dy < 1.1) {
              p.vx = -p.vx;

              let mult = BOUNCE_BOOST * boost;
              if (def.role === 'forward') mult *= 1 + (stat / 100) * 0.25;

              const speed = clamp(Math.hypot(p.vx, p.vy) * mult, BALL_SPEED * 0.8, BALL_MAX_SPD);
              const angle = Math.atan2(p.vy, p.vx);
              p.vx = Math.cos(angle) * speed;
              p.vy = Math.sin(angle) * speed + (Math.random() - 0.5) * 25;

              p.bx += Math.sign(p.bx - rx) * (rw + BALL_R + 1);
              hit = true;
              break;
            }
          }
        }
      }

      // Goal detection
      if (p.cooldown <= 0) {
        const goalH = f.h * GOAL_H_FRAC;
        const goalY = f.y + (f.h - goalH) / 2;
        const inGY = p.by > goalY && p.by < goalY + goalH;

        if (p.bx - BALL_R < f.x - GOAL_DEPTH + 3 && inGY) triggerGoal('blue');
        else if (p.bx + BALL_R > f.x + f.w + GOAL_DEPTH - 3 && inGY) triggerGoal('red');
      }

      // Flash decay
      if (p.flash) {
        p.flash.fa = Math.max(0, p.flash.fa - dt / 0.3);
        p.flash.ta = Math.max(0, p.flash.ta - dt / 1.5);
        if (p.flash.fa <= 0 && p.flash.ta <= 0) p.flash = null;
      }

      // Draw
      ctx.save();
      ctx.scale(dpr, dpr);
      drawField(f);
      drawRods(f, ms);
      drawBall();
      drawFlash(f);
      ctx.restore();

      rafRef.current = requestAnimationFrame(tick);
    }

    function triggerGoal(team: Team) {
      phys.current.cooldown = GOAL_COOLDOWN;
      phys.current.flash = { team, fa: 1, ta: 1 };
      onGoalRef.current(team);
      pushFeed(team, `${team === 'red' ? 'AgentRed' : 'AgentBlue'} scores!`);
      resetBall();
    }

    lastTRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg-panel)' }}>
      <div ref={containerRef} className="min-h-0 flex-1">
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
    </div>
  );
}
