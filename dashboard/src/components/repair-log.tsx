import type { HealEvent } from '@/lib/registry'
import { stamp } from '@/lib/format'
import { Pill } from './registry-table'

type Event = HealEvent & { domain: string }

function outcome(event: Event) {
  if (event.escalated || event.status === 'escalated')
    return <Pill tone="warn">rebuilt from scratch</Pill>
  if (event.status === 'resolved')
    return <Pill tone="good">repaired and verified</Pill>
  return <Pill tone="warn">{event.status ?? 'failed'}</Pill>
}

export function RepairLog({ events }: { events: Event[] }) {
  if (!events.length) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
        <p className="text-[17px] font-semibold">Nothing has broken yet.</p>
        <p className="mx-auto mt-2 max-w-[52ch] text-[14.5px] text-muted">
          Repairs are recorded here the moment a run comes back with missing or
          empty fields. An empty log means every scheduled run so far returned
          the data it was supposed to.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-line bg-surface px-6 shadow-card sm:px-8">
      {events.map((event, i) => (
        <div
          key={`${event.domain}-${event.timestamp}-${i}`}
          className={`grid gap-3 py-7 sm:grid-cols-[132px_1fr] sm:gap-6 ${
            i < events.length - 1 ? 'border-b border-line' : ''
          }`}
        >
          <div className="font-mono text-[12.5px] text-faint">
            {stamp(event.timestamp)}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold tracking-[-0.015em]">
                {event.domain}
              </span>
              {outcome(event)}
            </div>

            {event.prompt && (
              <p className="mt-2.5 border-l-2 border-line py-1 pl-4 text-[14.5px] text-muted">
                {event.prompt}
              </p>
            )}

            <p className="mt-2.5 text-[13px] text-faint">
              {[
                event.auto_triggered ? 'started on its own' : 'started by hand',
                event.replaced_by ? `replaced by ${event.replaced_by}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
