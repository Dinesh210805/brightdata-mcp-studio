import Link from 'next/link'
import { Bar } from '@/components/app/bar'
import { Verdict } from '@/components/app/verdict'
import { Mosaic } from '@/components/app/mosaic'
import { Feed } from '@/components/app/feed'
import { Watch } from '@/components/app/watch'
import { Machine } from '@/components/app/machine'
import { load_registry, to_rows, to_stats } from '@/lib/registry'
import { to_verdict, to_feed, to_watch, summarize, total_rows_today } from '@/lib/derive'
import { load_runs, next_cron_run } from '@/lib/actions'

export const revalidate = 60

export const metadata = {
  title: 'Submission — Bright Data MCP Studio',
  description: 'Live data from our own deployment, for hackathon judging.',
}

// The judge's view: the same dashboard, pointed at our account, with sign-in
// and the trigger buttons off. It is built out of the app's own components on
// purpose — a separate judging page would be a second thing to keep true.

export default async function Submission() {
  const [registry, runs] = await Promise.all([load_registry(), load_runs()])

  const rows = to_rows(registry)
  const stats = to_stats(registry)

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2.5 bg-ink px-5 py-2.5 text-center text-body text-paper/85">
        <span className="pulse h-1.5 w-1.5 shrink-0 rounded-full bg-venom" />
        Hackathon submission — live data from our own deployment, no account
        needed.
      </div>

      <Bar
        alert={stats.drifting > 0}
        readonly_notice="read-only · our deployment"
      />

      <Verdict
        verdict={to_verdict(rows)}
        summary={summarize(rows, stats)}
        rows_today={total_rows_today(rows)}
        base="/submission/s"
      />

      <main className="mx-auto max-w-page space-y-16 px-6 py-14 sm:space-y-20">
        <p className="max-w-[62ch] text-sub leading-relaxed text-muted">
          Nothing here is seeded or mocked. Every row came from a real run
          against a live site, and every repair below started on its own.
        </p>

        {rows.length > 0 && <Mosaic rows={rows} base="/submission/s" />}
        {rows.length > 0 && <Watch matrix={to_watch(rows)} />}

        <Feed events={to_feed(registry)} />

        <Machine
          runs={runs}
          next_run={next_cron_run().getTime()}
          balance={null}
        />

        <div className="border-t border-gutter pt-8 text-read">
          <Link href="/" className="text-web hover:underline">
            ← Back to the product
          </Link>
        </div>
      </main>
    </>
  )
}
