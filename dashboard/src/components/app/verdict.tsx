import Link from 'next/link'
import type { Verdict as VerdictData } from '@/lib/derive'

// The page's voice, and the only element on it that is not inside a panel —
// which is exactly what makes it read as the dashboard talking rather than as
// one more widget.

interface VerdictProps {
  verdict: VerdictData
  summary: string
  rows_today: number
}

// Denser dots for a busier day. Real data driving an aesthetic property is the
// difference between texture and decoration.
function dot_density(rows_today: number): string {
  const busiest = 2000
  const ratio = Math.min(rows_today / busiest, 1)
  return `${(28 - ratio * 15).toFixed(1)}px`
}

export function Verdict({ verdict, summary, rows_today }: VerdictProps) {
  const bad = verdict.tone === 'bad'

  return (
    <section className="relative overflow-hidden border-b border-gutter">
      <div
        className="halftone halftone-fade absolute inset-0 -z-10"
        style={{ '--dot-density': dot_density(rows_today) } as React.CSSProperties}
      />

      <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 sm:pt-20 sm:pb-14">
        <p className="rise font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
          {bad ? 'Attention' : 'Status'}
        </p>

        <h1
          className={`rise mt-5 max-w-[19ch] font-display text-[clamp(2.6rem,7.5vw,5.2rem)]
            leading-[0.94] font-[900] tracking-[-0.045em]
            ${bad ? 'text-venom drift-text' : 'text-ink'}`}
        >
          {verdict.headline}
        </h1>

        <p className="rise mt-7 font-mono text-[12.5px] tracking-[0.02em] text-muted tabular">
          {summary}
        </p>

        {/* Naming the casualties directly. "1 scraper is broken" without
            saying which one just moves the question along. */}
        {verdict.broken.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {verdict.broken.map(row => (
              <li key={row.domain}>
                <Link
                  href={`/app/s/${row.domain}`}
                  className="inline-flex items-center gap-2 rounded-sm border border-venom/40 bg-venom-soft px-3 py-1.5 text-[13px] font-medium text-venom transition-colors hover:border-venom"
                >
                  {row.domain}
                  {row.missing_fields.length > 0 && (
                    <span className="font-mono text-[11.5px] opacity-70">
                      {row.missing_fields.join(' ')}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
