import { notFound } from 'next/navigation'
import { Bar } from '@/components/app/bar'
import { Detail } from '@/components/app/detail'
import { load_registry, to_rows, to_stats } from '@/lib/registry'
import { load_dataset } from '@/lib/data'

export const revalidate = 60

// The same view, public. A judge following a scraper card from the submission
// page must not be bounced to a sign-in screen.
export default async function PublicScraperPage(
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params
  const registry = await load_registry()
  const row = to_rows(registry).find(r => r.domain === decodeURIComponent(domain))
  if (!row)
    notFound()

  // After the guard on purpose: `row.domain` is a registry key we matched, not
  // the raw URL segment, and it is used to build a filesystem path.
  const data = await load_dataset(row.domain)

  return (
    <>
      <Bar
        alert={to_stats(registry).drifting > 0}
        readonly_notice="read-only · our deployment"
      />
      <Detail
        row={row}
        heals={registry[row.domain]?.heal_history ?? []}
        back_href="/submission"
        data={data}
      />
    </>
  )
}
