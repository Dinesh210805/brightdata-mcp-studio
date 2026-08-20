import type { WatchMatrix, Cell } from '@/lib/derive'

// Every field under observation, across every scraper, as one grid.
//
// This is the only place the mechanism becomes visible. Health is decided by
// comparing the fields a run produced against the baseline it produced last
// time, and nothing else in the interface shows that comparison happening —
// the mosaic shows the verdict, this shows the working.
//
// Deliberately the most technical-looking thing on the page. Pure mono, no
// panel chrome, maximum density: here the reader should feel they are looking
// at an instrument rather than at a webpage.

function Mark({ cell }: { cell: Cell }) {
  if (cell === 'present') {
    return (
      <span className="inline-block h-[7px] w-[7px] rounded-full bg-ink" />
    )
  }
  if (cell === 'missing') {
    return (
      <span className="pulse inline-block h-[9px] w-[9px] rotate-45 bg-venom" />
    )
  }
  return <span className="inline-block h-[3px] w-[3px] rounded-full bg-hairline" />
}

export function Watch({ matrix }: { matrix: WatchMatrix }) {
  if (!matrix.fields.length)
    return null

  return (
    <section>
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[13px] font-[700] tracking-[0.14em] text-faint uppercase">
          Under watch
        </h2>
        <span className="font-mono text-[11.5px] text-faint tabular">
          {matrix.fields.length} fields
        </span>
      </header>

      <p className="mt-3 max-w-[64ch] text-[14px] leading-relaxed text-muted">
        A run that returns the right number of rows with the values missing has
        still failed. These are the fields each scraper is expected to produce
        — when one stops coming back, a repair starts on its own.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse font-mono text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-paper py-2 pr-6 text-left text-[10.5px] font-medium tracking-[0.08em] text-faint uppercase">
                Site
              </th>
              {matrix.fields.map(field => (
                <th
                  key={field}
                  className="px-2 pb-2 text-center align-bottom text-[11px] font-normal text-faint"
                >
                  {/* Vertical field names keep the columns tight enough that
                      the grid stays scannable as fields accumulate. */}
                  <span className="inline-block [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
                    {field}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(row => (
              <tr key={row.domain} className="border-t border-gutter">
                <td className="sticky left-0 bg-paper py-2.5 pr-6 whitespace-nowrap text-ink">
                  {row.domain}
                </td>
                {row.cells.map((cell, i) => (
                  <td key={matrix.fields[i]} className="px-2 py-2.5 text-center">
                    <Mark cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-faint">
        <li className="flex items-center gap-2">
          <Mark cell="present" /> present on the last run
        </li>
        <li className="flex items-center gap-2">
          <Mark cell="missing" /> stopped coming back
        </li>
        <li className="flex items-center gap-2">
          <Mark cell="na" /> not extracted from this site
        </li>
      </ul>
    </section>
  )
}
