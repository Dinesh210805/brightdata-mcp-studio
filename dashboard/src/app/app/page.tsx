import { redirect } from 'next/navigation'
import { Bar } from '@/components/app/bar'
import { Verdict } from '@/components/app/verdict'
import { Mosaic } from '@/components/app/mosaic'
import { Feed } from '@/components/app/feed'
import { Watch } from '@/components/app/watch'
import { Machine } from '@/components/app/machine'
import { Connect } from '@/components/app/connect'
import { auth_configured, current_user } from '@/lib/supabase/server'
import { get_profile } from '@/lib/profile'
import { load_registry, to_rows, to_stats, to_owned_collectors } from '@/lib/registry'
import { load_collectors, to_collector_view } from '@/lib/collectors'
import { Collectors } from '@/components/app/collectors'
import { to_verdict, to_feed, to_watch, summarize, total_rows_today } from '@/lib/derive'
import { load_runs, next_cron_run } from '@/lib/actions'
import { load_balance } from '@/lib/balance'

export const metadata = { title: 'Overview — Bright Data MCP Studio' }

// Rendered per request: this page puts the signed-in person's own Bright Data
// key into the config block, so it must never be served from a cache built for
// somebody else.
export const dynamic = 'force-dynamic'

export default async function Overview() {
  if (!auth_configured())
    redirect('/login')

  const user = await current_user()
  if (!user)
    redirect('/login')

  const profile = await get_profile()
  const api_key = profile?.brightdata_key ?? null

  const [registry, runs, balance, collectors] = await Promise.all([
    load_registry(),
    load_runs(),
    load_balance(api_key),
    load_collectors(api_key),
  ])

  const rows = to_rows(registry)
  const stats = to_stats(registry)
  const verdict = to_verdict(rows)

  return (
    <>
      <Bar alert={stats.drifting > 0} email={profile?.email ?? user.email} />

      <Verdict
        verdict={verdict}
        summary={summarize(rows, stats)}
        rows_today={total_rows_today(rows)}
        base="/app/s"
      />

      <main className="mx-auto max-w-page space-y-16 px-6 py-14 sm:space-y-20">
        {/* Setup first only while there is setup left to do. Once the agent is
            talking to us this collapses to a single line at the bottom. */}
        {!api_key && (
          <Connect has_key={false} api_key={null} last_sync={null} />
        )}

        {rows.length > 0 && <Mosaic rows={rows} base="/app/s" />}

        {rows.length > 0 && <Watch matrix={to_watch(rows)} />}

        <Feed events={to_feed(registry)} />

        {/* Only with a key of their own - this is a live call to Bright Data
            on the signed-in person's behalf, not something we can fake. */}
        {collectors && (
          <Collectors
            collectors={to_collector_view(collectors,
              to_owned_collectors(registry))}
          />
        )}

        <Machine
          runs={runs}
          next_run={next_cron_run().getTime()}
          balance={balance}
        />

        {api_key && (
          <Connect has_key api_key={api_key} last_sync={stats.last_run_at} />
        )}
      </main>
    </>
  )
}
