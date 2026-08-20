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

const LIMITS = [
  {
    h: 'Rebuilds orphan collectors',
    p: 'Bright Data exposes no delete API. Every escalation leaves a dead '
      + 'collector on the account forever, which is why it is capped at one.',
  },
  {
    h: 'Building a scraper takes 5–10 minutes',
    p: 'It is an AI job. It happens once per site, then every run after that '
      + 'reuses it and takes seconds.',
  },
  {
    h: 'Some breaks here were induced',
    p: 'Waiting for a real site to change its layout is not something a '
      + 'deadline allows. Where a break was induced we say so on the repair '
      + 'itself — the detection, the prompt, the fix and the verifying run '
      + 'that follow are all real.',
  },
  {
    h: 'AI jobs cannot run in parallel',
    p: 'The account caps concurrent jobs, so sites are healed one at a time '
      + 'and the cron runs them sequentially.',
  },
]

export default async function Submission() {
  const [registry, runs] = await Promise.all([load_registry(), load_runs()])

  const rows = to_rows(registry)
  const stats = to_stats(registry)

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2.5 bg-ink px-5 py-2.5 text-center text-body text-white/85">
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

        <section>
          <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
            What does not work yet
          </h2>
          <p className="mt-3 max-w-[62ch] text-read text-muted">
            Judging this fairly means knowing the edges, so here they are.
          </p>
          <ul className="mt-6 grid gap-px overflow-hidden rounded-sm border border-gutter bg-gutter sm:grid-cols-2">
            {LIMITS.map(item => (
              <li key={item.h} className="bg-surface px-6 py-6">
                <h3 className="font-display text-lead font-[700] tracking-[-0.015em]">
                  {item.h}
                </h3>
                <p className="mt-2 text-read leading-relaxed text-muted">
                  {item.p}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="border-t border-gutter pt-8 text-read">
          <Link href="/" className="text-web hover:underline">
            ← Back to the product
          </Link>
        </div>
      </main>
    </>
  )
}
