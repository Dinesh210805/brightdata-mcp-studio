import type { Stats } from '@/lib/registry'
import { on_date } from '@/lib/format'

export function StatsStrip({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Scrapers', value: String(stats.scrapers), small: false },
    { label: 'Rows last run', value: stats.rows.toLocaleString(), small: false },
    { label: 'Repairs', value: String(stats.heals), small: false },
    { label: 'Watching since', value: on_date(stats.watching_since), small: true },
  ]

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
      {items.map(item => (
        <div key={item.label} className="bg-surface px-6 py-6">
          <dt className="text-[11.5px] tracking-[0.05em] text-faint uppercase">
            {item.label}
          </dt>
          <dd
            className={`mt-2 font-semibold tracking-[-0.03em] tabular ${
              item.small ? 'text-[1.15rem]' : 'text-[1.9rem]'
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
