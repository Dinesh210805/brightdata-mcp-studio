import Link from 'next/link'
import type { RegistryRow, HealEvent } from '@/lib/registry'
import { Sparkline } from '@/components/ui/sparkline'
import { RecordCard } from '@/components/record-card'
import { DataTable } from '@/components/app/dataset'
import type { Dataset } from '@/lib/data'
import { ago, stamp } from '@/lib/format'

// One scraper's whole life on a page.
//
// Shared by the signed-in route and the public judging route, because they
// show exactly the same thing — the only difference is who is allowed to look
// and whether there is a way back to an account.

interface DetailProps {
  row: RegistryRow
  heals: HealEvent[]
  back_href: string
  // Absent until a run comes back healthy — only healthy runs are stored, so a
  // brand new or currently drifting scraper legitimately has no file yet.
  data: Dataset | null
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10.5px] tracking-[0.1em] text-faint uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 font-mono text-[13px] text-ink tabular">
        {children}
      </dd>
    </div>
  )
}

function Outcome({ heal }: { heal: HealEvent }) {
  if (heal.escalated || heal.status === 'escalated') {
    return (
      <span className="rounded-sm bg-venom-soft px-2.5 py-1 text-[11.5px] font-semibold text-venom">
        Rebuilt from scratch
      </span>
    )
  }
  if (heal.status === 'resolved') {
    return (
      <span className="rounded-sm bg-verified-soft px-2.5 py-1 text-[11.5px] font-semibold text-verified">
        Repaired and verified
      </span>
    )
  }
  return (
    <span className="rounded-sm bg-venom-soft px-2.5 py-1 text-[11.5px] font-semibold text-venom">
      Repair {heal.status ?? 'failed'}
    </span>
  )
}

export function Detail({ row, heals, back_href, data }: DetailProps) {
  const drifting = row.state === 'drifting'

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24">
      <div className="pt-8">
        <Link
          href={back_href}
          className="font-mono text-[12px] text-faint hover:text-ink"
        >
          ← all scrapers
        </Link>
      </div>

      <header className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className={`font-display text-[clamp(2rem,5.5vw,3.4rem)] leading-[1] font-[900] tracking-[-0.04em]
                ${drifting ? 'text-venom drift-text' : ''}`}
            >
              {row.domain}
            </h1>
            <p className="mt-2.5 text-[16px] text-muted">{row.description}</p>
          </div>

          <span
            className={`rounded-sm px-3 py-1.5 text-[12.5px] font-semibold ${
              drifting
                ? 'bg-venom-soft text-venom'
                : row.state === 'abandoned'
                  ? 'bg-raised text-faint'
                  : 'bg-verified-soft text-verified'
            }`}
          >
            {drifting
              ? 'not returning data'
              : row.state === 'abandoned' ? 'abandoned' : 'healthy'}
          </span>
        </div>

        <dl className="mt-8 grid gap-6 border-t border-gutter pt-6 sm:grid-cols-4">
          <Fact label="Collector">{row.collector_id}</Fact>
          <Fact label="Last run">{ago(row.last_run_at)}</Fact>
          <Fact label="Rows">{row.last_row_count ?? '—'}</Fact>
          <Fact label="Repairs">{row.heal_count}</Fact>
        </dl>
      </header>

      {/* Rows over time. The line usually stays flat through a break — a
          scraper that loses its selectors keeps returning the same number of
          rows with the values gone — so the markers are what carry the story
          and the field list underneath is what explains it. */}
      <section className="mt-14">
        <h2 className="font-display text-[13px] font-[700] tracking-[0.14em] text-faint uppercase">
          Rows per run
        </h2>
        <div className={`mt-5 p-6 ${drifting ? 'panel drift' : 'panel'}`}>
          <div className="h-20">
            <Sparkline runs={row.runs} className="!h-20" />
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-gutter pt-4 font-mono text-[11.5px] text-faint">
            <span>
              {row.runs.length} {row.runs.length === 1 ? 'run' : 'runs'} recorded
            </span>
            <span className="tabular">
              {row.runs.filter(r => !r.healthy).length} came back wrong
            </span>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-[13px] font-[700] tracking-[0.14em] text-faint uppercase">
          Fields under watch
        </h2>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-muted">
          The shape of the last good run. If one of these stops coming back,
          that is what triggers a repair — and what gets described in the
          repair prompt.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {row.schema_baseline.map(field => {
            const gone = row.missing_fields.includes(field)
            return (
              <li
                key={field}
                className={`rounded-sm px-3 py-1.5 font-mono text-[12.5px] ${
                  gone
                    ? 'bg-venom-soft text-venom line-through decoration-venom/60'
                    : 'bg-raised text-muted'
                }`}
              >
                {field}
              </li>
            )
          })}
          {!row.schema_baseline.length && (
            <li className="font-mono text-[12.5px] text-faint">
              no baseline yet — it is set by the first good run
            </li>
          )}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-[13px] font-[700] tracking-[0.14em] text-faint uppercase">
          Repair history
        </h2>

        {heals.length === 0 ? (
          <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-muted">
            This scraper has never needed repair. Every run so far returned the
            fields it was supposed to.
          </p>
        ) : (
          <ol className="mt-6 space-y-4">
            {heals.map((heal, i) => (
              <li key={`${heal.timestamp}-${i}`} className="panel-loud p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-[12px] text-faint tabular">
                    {stamp(heal.timestamp)}
                  </span>
                  <Outcome heal={heal} />
                </div>
                {heal.prompt && (
                  <blockquote className="mt-3.5 border-l-2 border-ink/15 pl-4 text-[14px] leading-relaxed text-muted">
                    {heal.prompt}
                  </blockquote>
                )}
                {heal.replaced_by && (
                  <p className="mt-3 font-mono text-[11.5px] text-faint">
                    replaced by {heal.replaced_by}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* The stored file supersedes the single-record preview when it exists.
          Without one — a scraper that has never had a healthy run, or one
          drifting right now — the registry's sample is the only look at what
          came back, and on a broken scraper that is the interesting part. */}
      {data
        ? <DataTable data={data} domain={row.domain} />
        : row.sample.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-[13px] font-[700] tracking-[0.14em] text-faint uppercase">
              What it last returned
            </h2>
            <div className="mt-5">
              <RecordCard record={row.sample[0]} />
            </div>
          </section>
        )}

      <section className="mt-14 border-t border-gutter pt-6">
        <p className="font-mono text-[11.5px] text-faint">
          source ·{' '}
          <a
            href={row.source_url}
            target="_blank"
            rel="noopener nofollow"
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            {row.source_url}
          </a>
        </p>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-faint">
          Running and repairing this scraper on demand happens through your
          coding agent today — <code className="font-mono">scraper_run</code>{' '}
          and <code className="font-mono">scraper_heal</code>. Buttons here are
          the next piece of work, not a shipped feature.
        </p>
      </section>
    </main>
  )
}
