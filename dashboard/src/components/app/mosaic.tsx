import Link from 'next/link'
import type { RegistryRow } from '@/lib/registry'
import { Sparkline } from '@/components/ui/sparkline'
import { ago } from '@/lib/format'

// How the scrapers are presented.
//
// Not a uniform card grid: one scraper gets the feature panel and the rest sit
// in a compact rail beneath it. The feature slot is decided by state, not by
// position in the file — a drifting scraper always takes it, otherwise the
// busiest one does. So the largest thing on the page is always the thing most
// worth looking at, and the hierarchy re-sorts itself as the data changes.

function pick_feature(rows: RegistryRow[]): RegistryRow | null {
  const active = rows.filter(r => r.state !== 'abandoned')
  if (!active.length)
    return null
  return active.find(r => r.state === 'drifting')
    ?? [...active].sort((a, b) =>
      (b.last_row_count ?? 0) - (a.last_row_count ?? 0))[0]
}

function StateDot({ state }: { state: RegistryRow['state'] }) {
  const tone = {
    healthy: 'bg-verified',
    drifting: 'bg-venom',
    abandoned: 'bg-faint',
  }[state]
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tone}
        ${state === 'drifting' ? 'pulse' : ''}`}
    />
  )
}

function StateLabel({ row }: { row: RegistryRow }) {
  const text = {
    healthy: row.heal_count ? `repaired ${row.heal_count}×` : 'healthy',
    drifting: 'not returning data',
    abandoned: 'abandoned',
  }[row.state]

  const tone = {
    healthy: 'text-verified',
    drifting: 'text-venom',
    abandoned: 'text-faint',
  }[row.state]

  return (
    <span className={`inline-flex items-center gap-2 text-meta font-medium ${tone}`}>
      <StateDot state={row.state} />
      {text}
    </span>
  )
}

// Baseline fields, with the ones that stopped coming back struck through. This
// is the single most information-dense element on the card: it names what is
// watched and what is wrong in the same breath.
function Fields({ row, limit }: { row: RegistryRow; limit?: number }) {
  const shown = limit ? row.schema_baseline.slice(0, limit) : row.schema_baseline
  const hidden = row.schema_baseline.length - shown.length

  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map(field => {
        const gone = row.missing_fields.includes(field)
        return (
          <li
            key={field}
            className={`rounded-sm px-2 py-1 font-mono text-micro ${
              gone
                ? 'bg-venom-soft text-venom line-through decoration-venom/60'
                : 'bg-raised text-muted'
            }`}
          >
            {field}
          </li>
        )
      })}
      {hidden > 0 && (
        <li className="px-1 py-1 font-mono text-micro text-faint">
          +{hidden}
        </li>
      )}
    </ul>
  )
}

function Meta({ row }: { row: RegistryRow }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-gutter pt-3 font-mono text-micro text-faint">
      <span className="tabular">
        {row.last_row_count ?? '—'} rows · {ago(row.last_run_at)}
      </span>
      <span className="truncate">{row.collector_id}</span>
    </div>
  )
}

function FeatureCard({ row, base }: { row: RegistryRow; base: string }) {
  const record = row.sample[0]
  const preview = record ? Object.entries(record).slice(0, 4) : []
  const drifting = row.state === 'drifting'

  return (
    <Link
      href={`${base}/${row.domain}`}
      className={`group block p-6 transition-transform hover:-translate-y-0.5 sm:p-7
        ${drifting ? 'panel drift' : 'panel-loud'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[clamp(1.35rem,2.6vw,2.2rem)] font-[800] tracking-[-0.03em]">
            {row.domain}
          </h3>
          <p className="mt-1 text-read text-muted">{row.description}</p>
        </div>
        <StateLabel row={row} />
      </div>

      <div className="mt-6">
        <Sparkline runs={row.runs} />
        <p className="mt-1.5 font-mono text-micro tracking-[0.08em] text-faint uppercase">
          {row.runs.length === 1
            ? 'first run — no trend yet'
            : `last ${row.runs.length} runs`}
        </p>
      </div>

      <div className="mt-6">
        <Fields row={row} />
      </div>

      {/* One real record. The product is the structured data coming out, so
          the product shot belongs on the biggest card. */}
      {preview.length > 0 && (
        <dl className="mt-6 grid gap-x-6 gap-y-2 border-t border-gutter pt-5 sm:grid-cols-2">
          {preview.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="font-mono text-micro tracking-[0.06em] text-faint uppercase">
                {key}
              </dt>
              <dd className="mt-0.5 truncate text-read">
                {value === null || value === undefined ? '—' : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5">
        <Meta row={row} />
      </div>
    </Link>
  )
}

function CompactCard({ row, base }: { row: RegistryRow; base: string }) {
  const drifting = row.state === 'drifting'

  return (
    <Link
      href={`${base}/${row.domain}`}
      className={`panel group flex flex-col p-5 transition-colors hover:border-ink
        ${drifting ? 'drift' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lead font-[700] tracking-[-0.02em]">
          {row.domain}
        </h3>
        <StateDot state={row.state} />
      </div>

      <div className="mt-4">
        <Sparkline runs={row.runs} />
      </div>

      <div className="mt-4">
        <Fields row={row} limit={4} />
      </div>

      <div className="mt-auto pt-4">
        <Meta row={row} />
      </div>
    </Link>
  )
}

// `base` differs by context: a judge on /submission must not be bounced to
// a sign-in screen by clicking the biggest card on the page.
export function Mosaic({ rows, base }: { rows: RegistryRow[]; base: string }) {
  const feature = pick_feature(rows)
  if (!feature)
    return null

  const rest = rows.filter(r => r.domain !== feature.domain)

  return (
    <section>
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
          Scrapers
        </h2>
        <span className="font-mono text-micro text-faint tabular">
          {rows.filter(r => r.state !== 'abandoned').length} active
        </span>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <FeatureCard row={feature} base={base} />

        {rest.length > 0 && (
          <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {rest.map(row => (
              <CompactCard key={row.domain} row={row} base={base} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
