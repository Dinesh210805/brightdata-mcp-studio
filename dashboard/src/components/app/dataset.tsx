import type { Dataset } from '@/lib/data'
import type { ScrapedRecord } from '@/lib/registry'

// The rows a run actually collected.
//
// Everything else on this page is evidence *about* the scraper — how many runs,
// which fields went missing, what got repaired. This is the thing itself. A
// self-healing pipeline that never shows you its output is asking to be taken
// on faith.

// Columns come from the records, not from the schema baseline: a break is
// exactly the moment those two disagree, and the file is what is on disk.
// Taken as a union across the shown rows, because sites omit optional fields
// on individual records.
function columns_of(records: ScrapedRecord[]): string[] {
  const seen = new Set<string>()
  for (const record of records)
    for (const key of Object.keys(record)) seen.add(key)
  return [...seen]
}

const EMPTY = <span className="text-faint">—</span>

// Values come off a page somebody else controls. React escapes them on render,
// which is why they can be shown verbatim — but the shapes vary, and a raw
// String() on an array gives comma-jammed soup across 25 rows.
function Cell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '')
    return EMPTY

  if (typeof value === 'number' || typeof value === 'boolean')
    return <span className="font-mono tabular">{String(value)}</span>

  if (Array.isArray(value)) {
    if (!value.length)
      return EMPTY
    const shown = value.slice(0, 3)
    return (
      <span className="flex flex-wrap gap-1">
        {shown.map((item, i) => (
          <span key={i} className="rounded-sm bg-raised px-1.5 py-0.5 text-micro text-muted">
            {String(item)}
          </span>
        ))}
        {value.length > shown.length && (
          <span className="px-1 py-0.5 text-micro text-faint">
            +{value.length - shown.length}
          </span>
        )}
      </span>
    )
  }

  if (typeof value === 'object')
    return <span className="font-mono text-micro text-muted">{JSON.stringify(value)}</span>

  const text = String(value)
  if (/^https?:\/\//.test(text)) {
    return (
      <a
        href={text}
        target="_blank"
        rel="noopener nofollow"
        className="font-mono text-micro text-web underline-offset-4 hover:underline"
      >
        {text.replace(/^https?:\/\/(www\.)?/, '')}
      </a>
    )
  }

  return <span>{text}</span>
}

export function DataTable({ data, domain }: { data: Dataset; domain: string }) {
  const columns = columns_of(data.records)
  const withheld = data.total - data.records.length

  return (
    <section className="mt-14">
      <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
        The data it collected
      </h2>
      <p className="mt-3 max-w-[62ch] text-read leading-relaxed text-muted">
        Every healthy run overwrites{' '}
        <code className="font-mono text-body">data/{domain}/latest.json</code>{' '}
        in the repo and keeps a timestamped copy beside it. The file below is
        public: no key, no API, nothing to sign into.
      </p>

      <div className="panel mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gutter px-5 py-3">
          <span className="flex items-center gap-2 font-mono text-micro tracking-wide text-faint uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-verified pulse" />
            {data.total} {data.total === 1 ? 'row' : 'rows'} · {columns.length} fields
          </span>
          <a
            href={data.url}
            target="_blank"
            rel="noopener"
            className="font-mono text-micro text-web underline-offset-4 hover:underline"
          >
            latest.json ↗
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="border-b border-gutter">
                {columns.map(column => (
                  <th
                    key={column}
                    className="px-5 py-3 text-left font-mono text-micro font-normal tracking-[0.08em] whitespace-nowrap text-faint uppercase"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.records.map((record, i) => (
                <tr
                  key={i}
                  className={i < data.records.length - 1 ? 'border-b border-gutter' : ''}
                >
                  {columns.map(column => (
                    <td
                      key={column}
                      className="max-w-[26ch] px-5 py-3 align-top leading-snug break-words"
                    >
                      <Cell value={record[column]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {withheld > 0 && (
          <div className="border-t border-gutter px-5 py-3 font-mono text-micro text-faint">
            showing the first {data.records.length} ·{' '}
            <a
              href={data.url}
              target="_blank"
              rel="noopener"
              className="text-web underline-offset-4 hover:underline"
            >
              {withheld} more in the file
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
