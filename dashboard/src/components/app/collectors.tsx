import type { CollectorView } from '@/lib/collectors'
import { ago } from '@/lib/format'

// What Bright Data says is on the account, next to what the registry can
// account for.
//
// Read live rather than from the registry, because the registry only knows
// about scrapers this server built. Anything else on the account - a rebuild's
// leftovers, something made in the web console, something from before - is
// invisible until you ask Bright Data directly.

export function Collectors({ collectors }: { collectors: CollectorView[] }) {
  const orphans = collectors.filter(c => !c.domain).length

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
          Collectors on your account
        </h2>
        <span className="font-mono text-micro text-faint tabular">
          live from Bright Data · {collectors.length}
        </span>
      </div>

      <p className="mt-3 max-w-[62ch] text-read leading-relaxed text-muted">
        Bright Data can list the collectors you own but not say what any of
        them is for — only the registry knows that. Anything below without a
        site is unaccounted for: usually the remains of a rebuild, and it
        still occupies a slot.
      </p>

      <div className="panel mt-5 overflow-hidden">
        <ul>
          {collectors.map((collector, i) => (
            <li
              key={collector.id}
              className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5 px-5 py-3.5
                ${i < collectors.length - 1 ? 'border-b border-gutter' : ''}`}
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span
                  className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-micro ${
                    collector.domain
                      ? 'bg-verified-soft text-verified'
                      : 'bg-venom-soft text-venom'
                  }`}
                >
                  {collector.domain ?? 'unaccounted for'}
                </span>
                <span className="truncate font-mono text-meta text-faint">
                  {collector.id}
                </span>
              </span>

              <span className="font-mono text-meta text-faint tabular">
                {collector.active ? ago(collector.last_run) : 'inactive'}
              </span>
            </li>
          ))}

          {!collectors.length && (
            <li className="px-5 py-6 text-read text-faint">
              Bright Data returned no collectors for this account.
            </li>
          )}
        </ul>

        {orphans > 0 && (
          <div className="border-t border-gutter bg-raised px-5 py-3 text-meta text-muted">
            {orphans} {orphans === 1 ? 'collector is' : 'collectors are'} not in
            the registry. A rebuild abandons the scraper it replaced, so these
            are usually its leftovers.
          </div>
        )}
      </div>
    </section>
  )
}
