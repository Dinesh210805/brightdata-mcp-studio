import { ACTIONS_URL, COMMITS_URL, type WorkflowRun } from '@/lib/actions'
import { Countdown } from './countdown'

// The machine room: the part that runs with nobody watching.
//
// Darkest surface on the page and mono throughout, because this is the floor
// the rest of the product stands on rather than something you interact with.
// Every number here is fetched, not asserted.

interface MachineProps {
  runs: WorkflowRun[]
  next_run: number
  balance: number | null
}

function tone_of(run: WorkflowRun): string {
  if (run.status !== 'completed')
    return 'bg-web pulse'
  if (run.conclusion === 'success')
    return 'bg-verified'
  if (run.conclusion === 'cancelled' || run.conclusion === 'skipped')
    return 'bg-white/25'
  return 'bg-venom'
}

function Stat({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="font-mono text-micro tracking-[0.12em] text-white/40 uppercase">
        {label}
      </dt>
      <dd className="mt-2 font-mono text-head text-white tabular">
        {children}
      </dd>
    </div>
  )
}

export function Machine({ runs, next_run, balance }: MachineProps) {
  const green = runs.filter(r => r.conclusion === 'success').length

  return (
    <section className="rounded-sm bg-paper px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-body font-[700] tracking-[0.14em] text-white/45 uppercase">
          Running with nobody watching
        </h2>
        <code className="font-mono text-meta text-white/45">0 */6 * * *</code>
      </div>

      {/* Only stats we actually have. A row of em-dashes reads as broken, and
          a number nobody can source is worse than an absent one. */}
      <dl className="mt-7 grid gap-7 sm:grid-cols-3">
        <Stat label="Next run">
          <Countdown target={next_run} />
        </Stat>
        {runs.length > 0 && (
          <Stat label="Recent runs green">{`${green}/${runs.length}`}</Stat>
        )}
        {balance !== null && (
          <Stat label="Bright Data balance">{`$${balance.toFixed(2)}`}</Stat>
        )}
      </dl>

      {/* Say why it is empty rather than showing an empty wall. An unexplained
          blank reads as broken; this reads as not started. */}
      {runs.length === 0 && (
        <p className="mt-7 max-w-[58ch] font-mono text-meta leading-relaxed text-white/45">
          No workflow runs to show yet. The cron reports here as soon as the
          repository is public and GitHub Actions has run it once.
        </p>
      )}

      {/* The wall of checks. Each one is a real workflow run and links to its
          own log, so a reader who doubts it can click straight through. */}
      {runs.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap gap-1.5">
            {[...runs].reverse().map(run => (
              <a
                key={run.id}
                href={run.html_url}
                target="_blank"
                rel="noopener"
                title={`#${run.run_number} · ${run.conclusion ?? run.status} · `
                  + new Date(run.created_at).toUTCString()}
                className={`h-7 w-3 rounded-[2px] transition-transform hover:scale-y-110 ${tone_of(run)}`}
              />
            ))}
          </div>
          <p className="mt-3 font-mono text-micro text-white/35">
            oldest → newest · every bar is one unattended run
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 font-mono text-meta">
        <a
          className="text-white/60 underline-offset-4 hover:text-white hover:underline"
          href={ACTIONS_URL}
          target="_blank"
          rel="noopener"
        >
          run history →
        </a>
        <a
          className="text-white/60 underline-offset-4 hover:text-white hover:underline"
          href={COMMITS_URL}
          target="_blank"
          rel="noopener"
        >
          registry commits →
        </a>
      </div>
    </section>
  )
}
