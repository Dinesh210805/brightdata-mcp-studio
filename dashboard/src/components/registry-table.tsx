'use client'

import { Fragment, useState } from 'react'
import type { RegistryRow } from '@/lib/registry'
import { ago } from '@/lib/format'

function StatePill({ row }: { row: RegistryRow }) {
  if (row.status === 'abandoned')
    return <Pill tone="off">abandoned</Pill>
  if (row.heal_count)
    return <Pill tone="warn">repaired {row.heal_count}×</Pill>
  return <Pill tone="good">healthy</Pill>
}

export function Pill({
  tone,
  children,
}: {
  tone: 'good' | 'warn' | 'off'
  children: React.ReactNode
}) {
  const tones = {
    good: 'bg-good-soft text-good',
    warn: 'bg-ember-soft text-ember',
    off: 'bg-raised text-faint',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function RegistryTable({ rows }: { rows: RegistryRow[] }) {
  const [open, set_open] = useState<string | null>(null)

  if (!rows.length) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center">
        <p className="text-[17px] font-semibold">No scrapers yet.</p>
        <p className="mx-auto mt-2 max-w-[46ch] text-[14.5px] text-muted">
          Ask your agent to scrape a public page. It builds the scraper once,
          then reuses it every run after that.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[14.5px]">
          <thead>
            <tr className="border-b border-line">
              {['Site', 'Collector', 'Last run', 'Rows', 'State'].map((h, i) => (
                <th
                  key={h}
                  className={`px-6 py-3.5 text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-faint uppercase ${
                    i === 3 ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const is_open = open === row.domain
              return (
                <Fragment key={row.domain}>
                  <tr
                    onClick={() => set_open(is_open ? null : row.domain)}
                    className="cursor-pointer border-b border-line-soft transition-colors last:border-b-0 hover:bg-raised"
                  >
                    <td className="px-6 py-4 font-medium tracking-[-0.012em]">
                      {row.domain}
                    </td>
                    <td className="px-6 py-4 font-mono text-[12.5px] text-muted">
                      {row.collector_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted">
                      {ago(row.last_run_at)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono tabular">
                      {row.last_row_count ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <StatePill row={row} />
                    </td>
                  </tr>

                  {is_open && (
                    <tr className="bg-raised">
                      <td colSpan={5} className="px-6 py-5">
                        <p className="mb-2.5 text-[12.5px] text-faint">
                          Last sample from {row.domain} — {row.description}
                        </p>
                        <pre className="max-h-80 overflow-auto rounded-xl border border-line bg-surface px-4 py-3.5 font-mono text-[12.5px] leading-relaxed">
                          {JSON.stringify(row.sample, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
