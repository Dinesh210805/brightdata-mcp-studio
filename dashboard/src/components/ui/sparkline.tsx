import type { RunPoint } from '@/lib/registry'

// Row count over the last runs. The reason this earns its space: a scraper
// that breaks usually keeps returning the right *number* of rows with the
// values missing, so the line stays flat and the marker underneath it is what
// tells you something happened. Row count alone would say everything is fine.
//
// A fixed viewBox stretched with preserveAspectRatio="none" would squash the
// stroke, so the geometry is normalised into the box and the stroke is kept
// honest with vector-effect.

const W = 100
const H = 30

interface SparklineProps {
  runs: RunPoint[]
  className?: string
}

export function Sparkline({ runs, className = '' }: SparklineProps) {
  if (runs.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={`h-[30px] w-full ${className}`}
        aria-hidden
      >
        <line
          x1="0" y1={H / 2} x2={W} y2={H / 2}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
          className="text-hairline"
        />
      </svg>
    )
  }

  const counts = runs.map(r => r.rows)
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const span = max - min || 1

  // 2px of padding top and bottom so a peak is not clipped by the viewBox.
  const point = (run: RunPoint, i: number) => {
    const x = (i / (runs.length - 1)) * W
    const y = H - 2 - ((run.rows - min) / span) * (H - 4)
    return [x, y] as const
  }

  const coords = runs.map(point)
  const line = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${coords[0][0]},${H} ${line} ${coords.at(-1)![0]},${H}`

  const broke = runs.some(r => !r.healthy)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`h-[30px] w-full ${className}`}
      aria-hidden
    >
      <polygon
        points={area}
        className={broke ? 'fill-venom/8' : 'fill-web/8'}
      />
      <polyline
        points={line}
        fill="none"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={broke ? 'stroke-venom/70' : 'stroke-web/70'}
      />
      {/* Only the failures get a marker. Marking every run would turn the
          line into a bead chain and hide the one point that matters. */}
      {runs.map((run, i) => {
        if (run.healthy)
          return null
        const [x, y] = coords[i]
        return (
          <circle
            key={`${run.at}-${i}`}
            cx={x}
            cy={y}
            r="2.5"
            className="fill-venom"
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}
