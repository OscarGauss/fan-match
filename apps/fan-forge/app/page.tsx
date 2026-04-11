import Link from 'next/link'

function TeamCard({
  team,
  label,
  accent,
  dimBg,
  border,
}: {
  team: string
  label: string
  accent: string
  dimBg: string
  border: string
}) {
  return (
    <Link href="/game" className="group flex-1 min-w-[220px] max-w-[300px]">
      <div
        className="flex flex-col gap-5 rounded-xl border p-6 transition-all duration-200 group-hover:scale-[1.02]"
        style={{
          background: dimBg,
          borderColor: border,
        }}
      >
        {/* Color dot + team name */}
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
            {label}
          </span>
        </div>

        {/* Agent status */}
        <div>
          <p
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {team}
          </p>
          <p className="mt-1 text-xs mono" style={{ color: 'var(--text-muted)' }}>
            Agent online · base stats
          </p>
        </div>

        {/* Stat bars placeholder */}
        <div className="flex flex-col gap-2">
          {['GK', 'DEF', 'MID', 'FWD'].map((role) => (
            <div key={role} className="flex items-center gap-2">
              <span className="w-8 text-[10px] mono" style={{ color: 'var(--text-dim)' }}>
                {role}
              </span>
              <div
                className="h-1 flex-1 rounded-full"
                style={{ background: 'var(--border-accent)' }}
              >
                <div
                  className="h-full w-1/2 rounded-full"
                  style={{ background: accent, opacity: 0.6 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-bold tracking-wide transition-opacity duration-150 hover:opacity-90"
          style={{ background: accent, color: '#0a0a0f' }}
        >
          Join team
        </button>
      </div>
    </Link>
  )
}

export default function LobbyPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16"
      style={{ background: 'var(--bg-root)' }}
    >
      {/* Logo */}
      <div className="mb-4 flex items-baseline gap-0">
        <span className="text-6xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Fan
        </span>
        <span className="text-6xl font-black tracking-tight" style={{ color: 'var(--red)' }}>
          Forge
        </span>
      </div>

      {/* Tagline */}
      <p className="mb-14 text-base" style={{ color: 'var(--text-muted)' }}>
        AI plays.&nbsp;Fans forge the outcome.
      </p>

      {/* Team cards */}
      <div className="flex w-full max-w-xl flex-wrap justify-center gap-4">
        <TeamCard
          team="AgentRed"
          label="Team Red"
          accent="var(--red)"
          dimBg="var(--red-dim)"
          border="var(--red-border)"
        />
        <TeamCard
          team="AgentBlue"
          label="Team Blue"
          accent="var(--blue)"
          dimBg="var(--blue-dim)"
          border="var(--blue-border)"
        />
      </div>

      {/* Match countdown note */}
      <p className="mt-10 text-sm mono" style={{ color: 'var(--text-dim)' }}>
        Match starts in&nbsp;
        <span style={{ color: 'var(--text-muted)' }}>00:30</span>
      </p>
    </div>
  )
}
