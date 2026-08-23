import type { RegistryRow } from '@/lib/registry'
import type { MonitoringRow } from '@/lib/derive'
import { RecordCard } from '@/components/record-card'
import { ago } from '@/lib/format'

// Which schedule is actually watching each scraper, read from what really
// ran (MonitoringRow.watched_by) rather than assumed from the workflow
// files. A scraper the fast loop hasn't reached yet says so honestly instead
// of claiming a cadence nothing has confirmed.
function cadence_label(watched_by: MonitoringRow['watched_by']): string {
  if (watched_by.includes('fast_check'))
    return 'checked every 15 min'
  if (watched_by.includes('ensure'))
    return 'checked every 6 hr'
  return 'not checked yet'
}

function StateDot({ state }: { state: MonitoringRow['state'] }) {
  const tone = state === 'drifting' ? 'bg-venom' : 'bg-verified'
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tone} ${
        state === 'drifting' ? 'pulse' : ''
      }`}
    />
  )
}

export function Monitoring({
  monitoring,
  rows,
}: {
  monitoring: MonitoringRow[]
  rows: RegistryRow[]
}) {
  const by_domain = new Map(rows.map(r => [r.domain, r]))

  return (
    <section>
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
          Monitoring
        </h2>
        <span className="font-mono text-micro text-faint tabular">
          {monitoring.length} watched
        </span>
      </header>
      <p className="mt-2 max-w-[60ch] text-body text-faint">
        What each scraper is actually being checked by — read from real check
        history, not from what the schedule intends.
      </p>

      {monitoring.length === 0 ? (
        <div className="panel mt-5 px-6 py-10 text-center">
          <p className="text-lead font-semibold">Nothing is being watched yet.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {monitoring.map(m => {
            const row = by_domain.get(m.domain)
            const output = row?.sample?.[0]
            return (
              <details key={m.domain} className="panel group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <StateDot state={m.state} />
                    <span className="truncate font-mono text-body font-medium">
                      {m.domain}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-micro text-faint transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-micro text-faint">
                  <span>{cadence_label(m.watched_by)}</span>
                  <span>·</span>
                  <span className="tabular">checked {ago(m.last_checked_at)}</span>
                </div>
                {output && (
                  <div className="mt-4 border-t border-gutter pt-4">
                    <p className="mb-2 font-mono text-micro text-faint uppercase">
                      Last tool output
                    </p>
                    <RecordCard record={output} />
                  </div>
                )}
              </details>
            )
          })}
        </div>
      )}
    </section>
  )
}
