// A radial spider web with brand wordmarks caught in the silk.
// Bright Data logo mark at the centre, company names placed along
// the strands. Pure inline SVG, no dependencies.

const BRANDS = [
  'Amazon', 'Walmart', 'eBay', 'Home Depot', 'Zara', 'Etsy',
  'Best Buy', 'Google Shopping', 'LinkedIn', 'Instagram', 'Facebook',
  'TikTok', 'X', 'YouTube', 'Reddit', 'Yahoo Finance', 'Crunchbase',
  'ZoomInfo', 'Google Maps', 'Zillow', 'Booking', 'GitHub', 'Reuters',
  'Google Play', 'App Store', 'ChatGPT', 'Grok', 'Perplexity',
  'npm', 'PyPI',
] as const

const BRAND_COUNT = BRANDS.length

// Place brands across three concentric rings of the web
const RINGS = [
  { radius: 38, count: 12, offset: -Math.PI / 12 },
  { radius: 27, count: 10, offset: Math.PI / 10 },
  { radius: 16, count: 8, offset: 0 },
]

function brandPositions() {
  const positions: Array<{ x: number; y: number; label: string; size: number; opacity: number }> = []
  let idx = 0
  for (const ring of RINGS) {
    for (let i = 0; i < ring.count && idx < BRAND_COUNT; i++) {
      const angle = ring.offset + (i / ring.count) * Math.PI * 2
      positions.push({
        x: 50 + Math.cos(angle) * ring.radius,
        y: 50 + Math.sin(angle) * ring.radius,
        label: BRANDS[idx],
        size: ring.radius > 30 ? 2.1 : ring.radius > 20 ? 1.8 : 1.5,
        opacity: ring.radius > 30 ? 0.85 : ring.radius > 20 ? 0.65 : 0.45,
      })
      idx++
    }
  }
  return positions
}

const brands = brandPositions()

// Number of radial spokes
const SPOKES = 20
// Concentric ring radii for the silk
const SILK_RINGS = [10, 18, 27, 35, 42]

export function WebGraphic() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full"
      aria-label="Spider web showing sites Bright Data already covers"
    >
      {/* Radial spokes */}
      {Array.from({ length: SPOKES }).map((_, i) => {
        const angle = (i / SPOKES) * Math.PI * 2
        const x2 = 50 + Math.cos(angle) * 48
        const y2 = 50 + Math.sin(angle) * 48
        return (
          <line
            key={`s-${i}`}
            x1={50}
            y1={50}
            x2={x2}
            y2={y2}
            stroke="var(--color-web)"
            strokeWidth={0.15}
            opacity={0.18}
          />
        )
      })}

      {/* Concentric silk rings */}
      {SILK_RINGS.map((r) => (
        <circle
          key={`r-${r}`}
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke="var(--color-web)"
          strokeWidth={0.12}
          opacity={0.14}
        />
      ))}

      {/* Faint pulses travelling inward along two spokes */}
      {[3, 11].map((spoke) => {
        const angle = (spoke / SPOKES) * Math.PI * 2
        const x1 = 50 + Math.cos(angle) * 44
        const y1 = 50 + Math.sin(angle) * 44
        return (
          <circle
            key={`pulse-${spoke}`}
            r={0.6}
            fill="var(--color-web)"
            opacity={0.5}
          >
            <animateMotion
              dur={`${3 + spoke * 0.2}s`}
              repeatCount="indefinite"
              path={`M ${x1} ${y1} L 50 50`}
            />
          </circle>
        )
      })}

      {/* Centre glow */}
      <circle cx={50} cy={50} r={4} fill="var(--color-web)" opacity={0.06} />
      <circle cx={50} cy={50} r={2.5} fill="var(--color-web)" opacity={0.12} />

      {/* Centre mark — "BD" wordmark instead of sourcing a logo */}
      <text
        x={50}
        y={50.5}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-web)"
        fontSize={3.2}
        fontFamily="var(--font-sans)"
        fontWeight={800}
        letterSpacing={0.3}
      >
        BD
      </text>

      {/* Brand wordmarks placed on the web */}
      {brands.map(({ x, y, label, size, opacity }) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-ink)"
          fontSize={size}
          fontFamily="var(--font-sans)"
          fontWeight={600}
          opacity={opacity}
        >
          {label}
        </text>
      ))}
    </svg>
  )
}
