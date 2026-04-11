interface MoraleBarProps {
  moraleA: number
  moraleB: number
}

export default function MoraleBar({ moraleA, moraleB }: MoraleBarProps) {
  const total = moraleA + moraleB
  const pctA = total === 0 ? 50 : Math.round((moraleA / total) * 100)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs font-medium text-zinc-500">
        <span>Team A — {moraleA}</span>
        <span>Morale</span>
        <span>{moraleB} — Team B</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pctA}%` }}
        />
        <div className="h-full flex-1 bg-red-500" />
      </div>
    </div>
  )
}
