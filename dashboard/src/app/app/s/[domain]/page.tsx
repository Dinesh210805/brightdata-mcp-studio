import { notFound, redirect } from 'next/navigation'
import { Bar } from '@/components/app/bar'
import { Detail } from '@/components/app/detail'
import { auth_configured, current_user } from '@/lib/supabase/server'
import { load_registry, to_rows, to_stats } from '@/lib/registry'
import { load_dataset } from '@/lib/data'

export const dynamic = 'force-dynamic'

// `params` is a Promise in this version of Next — see
// node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
export default async function ScraperPage(
  { params }: { params: Promise<{ domain: string }> },
) {
  if (!auth_configured())
    redirect('/login')
  if (!await current_user())
    redirect('/login')

  const { domain } = await params
  const registry = await load_registry()
  const rows = to_rows(registry)
  const row = rows.find(r => r.domain === decodeURIComponent(domain))
  if (!row)
    notFound()

  // After the guard on purpose: `row.domain` is a registry key we matched, not
  // the raw URL segment, and it is used to build a filesystem path.
  const data = await load_dataset(row.domain)

  return (
    <>
      <Bar alert={to_stats(registry).drifting > 0} />
      <Detail
        row={row}
        heals={registry[row.domain]?.heal_history ?? []}
        back_href="/app"
        data={data}
      />
    </>
  )
}
