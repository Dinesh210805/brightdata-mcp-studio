import type { ScrapedRecord } from '@/lib/registry'

// The product here is the structured data coming out, so one real record is
// the product shot. Values come from a page someone else controls; React
// escapes them on render, which is why they can be shown verbatim.

function value_class(value: unknown): string {
  if (typeof value === 'number')
    return 'font-mono text-lead tabular'
  if (typeof value === 'string' && /^https?:\/\//.test(value))
    return 'font-mono text-meta text-muted break-all'
  return 'text-sub tracking-[-0.012em]'
}

export function RecordCard({ record }: { record: ScrapedRecord }) {
  const fields = Object.entries(record)

  if (!fields.length) {
    return (
      <div className="rounded-sm border border-gutter bg-surface p-10 text-center text-lead text-faint ">
        No sample recorded yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-sm border border-gutter bg-surface ">
      <div className="flex items-center gap-2 border-b border-gutter px-6 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-verified pulse" />
        <span className="font-mono text-micro tracking-wide text-faint uppercase">
          one record, exactly as an agent receives it
        </span>
      </div>

      <dl className="px-6 sm:px-8">
        {fields.map(([key, value], i) => (
          <div
            key={key}
            className={`grid gap-2 py-4 sm:grid-cols-[128px_1fr] sm:gap-6 sm:py-[18px] ${
              i < fields.length - 1 ? 'border-b border-gutter' : ''
            }`}
          >
            <dt className="font-mono text-meta break-words text-faint">{key}</dt>
            <dd className={value_class(value)}>
              {value === null || value === undefined ? '—' : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
