import Link from 'next/link'
import { Nav } from '@/components/nav'
import { StatsStrip } from '@/components/stats-strip'
import { RegistryTable } from '@/components/registry-table'
import { RepairLog } from '@/components/repair-log'
import { load_registry, to_rows, to_heals, to_stats } from '@/lib/registry'

export const revalidate = 60

export const metadata = {
  title: 'Submission dashboard — Bright Data MCP Studio',
  description: 'Live data from our own deployment, for hackathon judging.',
}

const REPO = 'https://github.com/Dinesh210805/brightdata-mcp-studio'

function Section({
  id,
  title,
  blurb,
  children,
}: {
  id: string
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mt-20">
      <h2 className="font-display text-[clamp(1.7rem,3.4vw,2.3rem)] tracking-[-0.02em]">
        {title}
      </h2>
      <p className="mt-3 max-w-[62ch] text-[16px] text-muted">{blurb}</p>
      <div className="mt-7">{children}</div>
    </section>
  )
}

export default async function Submission() {
  const registry = await load_registry()
  const rows = to_rows(registry)
  const heals = to_heals(registry)
  const stats = to_stats(registry)

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2.5 bg-ink px-5 py-2.5 text-center text-[13.5px] text-white/90">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
        Hackathon submission dashboard — live data from our own deployment. This
        view comes down after judging.
      </div>

      <Nav />

      <main className="mx-auto max-w-5xl px-6 pb-28">
        <header className="pt-16">
          <p className="font-mono text-[11.5px] tracking-[0.14em] text-blue uppercase">
            Into the Scrape-Verse · WeMakeDevs × Bright Data
          </p>
          <h1 className="mt-5 max-w-[20ch] font-display text-[clamp(2.4rem,6vw,4rem)] leading-[1.02] tracking-[-0.028em]">
            Everything we built, running on real data.
          </h1>
          <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-muted">
            Nothing here is seeded or mocked. Every row came from a scheduled
            run against a live site, and every repair below happened without
            anyone watching.
          </p>
        </header>

        <div className="mt-12">
          <StatsStrip stats={stats} />
        </div>

        <Section
          id="registry"
          title="Registry"
          blurb="Bright Data has no API that lists the scrapers on an account. This
            file is the only place the site → scraper mapping exists anywhere.
            Open a row to see what it last returned."
        >
          <RegistryTable rows={rows} />
        </Section>

        <Section
          id="repairs"
          title="Repair log"
          blurb="Every repair attempt, newest first — what broke, what was sent to
            fix it, and whether it held."
        >
          <RepairLog events={heals} />
        </Section>

        <Section
          id="proof"
          title="Running with nobody watching"
          blurb="A GitHub Actions cron runs the whole loop every six hours and
            commits the result back. The commit history is the evidence — it
            accrues whether or not anyone is at a keyboard."
        >
          <div className="rounded-card border border-line bg-surface px-6 py-6 shadow-card">
            <p className="text-[15px] text-muted">
              <code className="font-mono text-[13.5px] text-ink">0 */6 * * *</code>
              <span className="mx-2.5 text-line">·</span>
              runs the registry, repairs what broke, commits what changed
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              <a
                className="text-blue hover:underline"
                href={`${REPO}/actions/workflows/scrape.yml`}
                target="_blank"
                rel="noopener"
              >
                View the run history →
              </a>
              <a
                className="text-blue hover:underline"
                href={`${REPO}/commits/main`}
                target="_blank"
                rel="noopener"
              >
                View the registry commits →
              </a>
            </div>
          </div>
        </Section>

        <Section
          id="honest"
          title="What does not work yet"
          blurb="Judging this fairly means knowing the edges, so here they are."
        >
          <ul className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
            {[
              {
                h: 'Rebuilds orphan collectors',
                p: 'Bright Data exposes no delete API. Every escalation leaves '
                  + 'a dead collector on the account forever, which is why it '
                  + 'is capped at one.',
              },
              {
                h: 'Building a scraper takes 5–10 minutes',
                p: 'It is an AI job. It happens once per site, then every run '
                  + 'after that reuses it.',
              },
              {
                h: 'The registry is single-account',
                p: 'One registry.json per deployment. Per-user registries are '
                  + 'the next piece of work, not a shipped feature.',
              },
              {
                h: 'AI jobs cannot run in parallel',
                p: 'The account caps concurrent jobs, so sites are healed one '
                  + 'at a time and the cron runs them sequentially.',
              },
            ].map(item => (
              <li key={item.h} className="bg-surface px-6 py-6">
                <h3 className="text-[15.5px] font-semibold tracking-[-0.015em]">
                  {item.h}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
                  {item.p}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <div className="mt-16 border-t border-line pt-8 text-[14px]">
          <Link href="/" className="text-blue hover:underline">
            ← Back to the product
          </Link>
        </div>
      </main>
    </>
  )
}
