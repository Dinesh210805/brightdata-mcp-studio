'use client'

import { useState } from 'react'
import type { CronPoint } from '@/lib/derive'
import { ago } from '@/lib/format'

// The two schedules, visible as two things. A merged feed makes "how often is
// this actually watched" impossible to answer without counting; a filter
// that separates them by what actually ran answers it directly.

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ensure', label: 'Full runs · every 6 hr' },
  { id: 'fast_check', label: 'Fast checks · every 15 min' },
] as const

function SourceTag({ source }: { source: CronPoint['source'] }) {
  if (source === 'fast_check') {
    return (
      <span className="rounded-sm bg-web-soft px-2 py-0.5 font-mono text-micro font-semibold text-web">
        fast check
      </span>
    )
  }
  if (source === 'ensure') {
    return (
      <span className="rounded-sm bg-raised px-2 py-0.5 font-mono text-micro text-muted">
        full run
      </span>
    )
  }
  return (
    <span className="rounded-sm bg-raised px-2 py-0.5 font-mono text-micro text-faint">
      unlabeled
    </span>
  )
}

export function CronLog({ points }: { points: CronPoint[] }) {
  const [filter, set_filter] = useState<typeof FILTERS[number]['id']>('all')
  const shown = filter === 'all' ? points : points.filter(p => p.source === filter)

  return (
    <section>
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
          Cron jobs
        </h2>
        <span className="font-mono text-micro text-faint tabular">
          {shown.length} of {points.length}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => set_filter(f.id)}
            className={`rounded-full border px-3 py-1 text-micro transition-colors ${
              filter === f.id
                ? 'border-ink bg-ink text-paper'
                : 'border-gutter text-muted hover:border-ink hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="panel mt-5 px-6 py-10 text-center">
          <p className="text-lead font-semibold">No runs yet on this schedule.</p>
        </div>
      ) : (
        <ol className="relative mt-5 ml-1">
          <span className="absolute inset-y-1 left-0 w-px bg-gutter" />
          {shown.slice(0, 30).map((p, i) => (
            <li key={`${p.domain}-${p.at}-${i}`} className="relative pb-3 pl-7">
              <span
                className={`absolute top-[7px] left-0 -translate-x-1/2 rounded-full ring-4 ring-paper ${
                  p.healthy ? 'h-1.5 w-1.5 bg-hairline' : 'h-2 w-2 bg-venom'
                }`}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-meta">
                <span className="w-[62px] shrink-0 text-faint tabular">{ago(p.at)}</span>
                <span className={p.healthy ? 'text-muted' : 'text-venom'}>{p.domain}</span>
                <SourceTag source={p.source} />
                <span className="text-faint tabular">
                  {p.healthy ? `${p.rows} rows` : 'data wrong'}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
