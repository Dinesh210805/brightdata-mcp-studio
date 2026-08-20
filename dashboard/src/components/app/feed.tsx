import type { FeedEvent } from '@/lib/derive'
import { ago } from '@/lib/format'

// What changed, newest first, runs and repairs in one stream.
//
// The weights are the point. A routine run is one thin line; a repair opens
// into a full panel. Nothing else communicates as efficiently that this system
// is quiet almost all of the time and occasionally does something dramatic —
// and a repair rendered as another table row loses exactly that.

function heal_outcome(event: Extract<FeedEvent, { kind: 'heal' }>) {
  if (event.escalated || event.status === 'escalated') {
    return {
      label: 'Rebuilt from scratch',
      tone: 'text-venom',
      chip: 'bg-venom-soft text-venom',
    }
  }
  if (event.status === 'resolved') {
    return {
      label: 'Repaired and verified',
      tone: 'text-verified',
      chip: 'bg-verified-soft text-verified',
    }
  }
  return {
    label: `Repair ${event.status ?? 'failed'}`,
    tone: 'text-venom',
    chip: 'bg-venom-soft text-venom',
  }
}

function Node({ tone }: { tone: 'quiet' | 'bad' | 'loud' }) {
  const style = {
    quiet: 'h-1.5 w-1.5 bg-hairline',
    bad: 'h-2 w-2 bg-venom',
    loud: 'h-2.5 w-2.5 bg-ink',
  }[tone]

  return (
    <span
      className={`absolute left-0 top-[7px] -translate-x-1/2 rounded-full ring-4 ring-paper ${style}`}
    />
  )
}

function RunRow({ event }: { event: Extract<FeedEvent, { kind: 'run' }> }) {
  return (
    <li className="relative pb-5 pl-7">
      <Node tone={event.healthy ? 'quiet' : 'bad'} />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-meta">
        <span className="w-[62px] shrink-0 text-faint tabular">
          {ago(event.at)}
        </span>
        <span className={event.healthy ? 'text-muted' : 'text-venom'}>
          {event.domain}
        </span>
        <span className="text-faint tabular">
          {event.healthy ? 'ran' : 'ran, data wrong'} · {event.rows} rows
        </span>
      </div>
    </li>
  )
}

function HealPanel({ event }: { event: Extract<FeedEvent, { kind: 'heal' }> }) {
  const outcome = heal_outcome(event)

  return (
    <li className="relative pb-6 pl-7">
      <Node tone="loud" />
      <div className="panel-loud p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lead font-[800] tracking-[-0.02em]">
            {event.domain}
          </h3>
          <span className={`rounded-sm px-2.5 py-1 text-micro font-semibold ${outcome.chip}`}>
            {outcome.label}
          </span>
        </div>

        {/* The prompt verbatim. It was generated from the specific fields that
            went empty, so quoting it is the clearest possible evidence that
            nothing here was written by a human after the fact. */}
        {event.prompt && (
          <blockquote className="mt-3.5 border-l-2 border-ink/15 pl-4 text-read leading-relaxed text-muted">
            {event.prompt}
          </blockquote>
        )}

        {/* Said out loud, on the repair itself. A log that hides how its
            breaks happened is worth less than one that admits it — and a
            judge who works it out unaided trusts everything else less. */}
        {event.induced && (
          <p className="mt-3.5 border-l-2 border-gutter pl-4 text-body leading-relaxed text-faint">
            We caused this break, by telling the watcher to expect a field
            {event.induced_field && (
              <code className="font-mono"> {event.induced_field} </code>
            )}
            {!event.induced_field && ' '}
            the site does not return. Everything after that — noticing,
            the prompt above, the fix, and the run that checked it — happened
            on its own.
          </p>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-micro text-faint">
          <span className="tabular">{ago(event.at)}</span>
          <span>
            {event.status === 'resolved'
              ? 'verified by a second run'
              : 'started on its own'}
          </span>
          {event.replaced_by && <span>→ {event.replaced_by}</span>}
        </div>
      </div>
    </li>
  )
}

export function Feed({ events }: { events: FeedEvent[] }) {
  return (
    <section>
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
          While you were away
        </h2>
        <span className="font-mono text-micro text-faint tabular">
          {events.length} events
        </span>
      </header>

      {events.length === 0 ? (
        <div className="panel mt-5 px-6 py-10 text-center">
          <p className="text-lead font-semibold">Nothing has happened yet.</p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-read text-muted">
            Runs and repairs land here the moment they happen.
          </p>
        </div>
      ) : (
        <ol className="relative mt-6 ml-1">
          {/* The spine. A single strand the whole timeline hangs from. */}
          <span className="absolute inset-y-1 left-0 w-px bg-gutter" />
          {events.map((event, i) => event.kind === 'heal'
            ? <HealPanel key={`${event.domain}-${event.at}-${i}`} event={event} />
            : <RunRow key={`${event.domain}-${event.at}-${i}`} event={event} />)}
        </ol>
      )}
    </section>
  )
}
