'use client'

import { useMemo, useState } from 'react'
import type { ToolGroup } from '@/lib/tools'

// Search plus group filter over a flat list, not an accordion per group.
// Ninety-two tools in fifteen open accordions is a page nobody scans; ninety-
// two tools behind one search box is a reference somebody actually uses.

function OriginBadge({ origin }: { origin: 'ours' | 'upstream' }) {
  return origin === 'ours' ? (
    <span className="shrink-0 rounded-sm bg-web-soft px-2 py-0.5 font-mono text-micro font-semibold text-web">
      this fork
    </span>
  ) : (
    <span className="shrink-0 rounded-sm bg-raised px-2 py-0.5 font-mono text-micro text-faint">
      upstream
    </span>
  )
}

export function ToolCatalog({ groups }: { groups: ToolGroup[] }) {
  const [query, set_query] = useState('')
  const [active, set_active] = useState<string | 'all'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .filter(g => active === 'all' || g.id === active)
      .map(g => ({
        ...g,
        tools: g.tools.filter(t =>
          !q || t.name.toLowerCase().includes(q)
          || t.description.toLowerCase().includes(q)),
      }))
      .filter(g => g.tools.length > 0)
  }, [groups, query, active])

  const shown = filtered.reduce((n, g) => n + g.tools.length, 0)

  return (
    <section className="mx-auto max-w-page px-6 py-12">
      <div className="sticky top-14 z-20 -mx-6 border-b border-gutter bg-paper/90 px-6 py-4 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={query}
            onChange={e => set_query(e.target.value)}
            placeholder="Search tools — “heal”, “linkedin”, “screenshot”…"
            className="w-full rounded-sm border border-gutter bg-surface px-4 py-2.5 text-body outline-none placeholder:text-faint focus:border-web sm:max-w-sm"
          />
          <span className="font-mono text-micro text-faint tabular">
            {shown} tool{shown === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => set_active('all')}
            className={`rounded-full border px-3 py-1 text-micro transition-colors ${
              active === 'all'
                ? 'border-ink bg-ink text-paper'
                : 'border-gutter text-muted hover:border-ink hover:text-ink'
            }`}
          >
            All groups
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => set_active(g.id)}
              className={`rounded-full border px-3 py-1 text-micro transition-colors ${
                active === g.id
                  ? 'border-ink bg-ink text-paper'
                  : 'border-gutter text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel mt-10 px-6 py-14 text-center">
          <p className="text-lead font-semibold">No tool matches “{query}”.</p>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {filtered.map(group => (
            <div key={group.id}>
              <div className="flex items-baseline justify-between gap-4 border-b border-gutter pb-3">
                <h2 className="font-display text-head font-[800] tracking-[-0.01em]">
                  {group.name}
                </h2>
                <span className="font-mono text-micro text-faint tabular">
                  {group.tools.length}
                </span>
              </div>
              <p className="mt-2.5 max-w-[62ch] text-body text-faint">
                {group.description}
              </p>

              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map(tool => (
                  <li key={`${group.id}-${tool.name}`} className="panel p-4">
                    <div className="flex items-start justify-between gap-2">
                      <code className="font-mono text-body font-semibold text-ink">
                        {tool.name}
                      </code>
                      <OriginBadge origin={tool.origin} />
                    </div>
                    <p className="mt-2 text-body leading-relaxed text-muted">
                      {tool.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
