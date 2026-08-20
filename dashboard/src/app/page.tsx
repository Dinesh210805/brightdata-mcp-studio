import Link from 'next/link'
import { Nav } from '@/components/nav'
import { RecordCard } from '@/components/record-card'
import { HeroGraphic } from '@/components/hero-graphic'
import { load_registry, to_rows, to_stats } from '@/lib/registry'
import { ago } from '@/lib/format'

export const revalidate = 60

const STEPS = [
  {
    title: 'Reuse what exists',
    body: 'Known site? Use the scraper already built for it. Building one '
      + 'takes 5–10 minutes and only ever happens once per site.',
  },
  {
    title: 'Run it',
    body: 'Collect the page and return structured records.',
  },
  {
    title: 'Check the data, not the status code',
    body: 'A run that "succeeds" and returns rows of empty fields has still '
      + 'failed. Missing fields and empty-value ratios are what get measured.',
  },
  {
    title: 'Describe the break, then repair',
    body: 'The specific problem — which field went empty — becomes the '
      + 'instruction sent to Bright Data\'s repair flow.',
  },
  {
    title: 'Run again to verify',
    body: 'The repair reports success when its AI job finishes, not when the '
      + 'data is correct. Without a second run, a repair that fixed nothing '
      + 'looks like a win.',
  },
  {
    title: 'Rebuild once, if it is still wrong',
    body: 'Capped at a single rebuild. The rebuild deletes the collector it '
      + 'abandoned and records what was deleted, so the account never quietly '
      + 'loses a scraper.',
  },
]

export default async function Home() {
  const registry = await load_registry()
  const rows = to_rows(registry)
  const stats = to_stats(registry)

  const newest = [...rows]
    .filter(r => r.last_run_at)
    .sort((a, b) => (b.last_run_at ?? '').localeCompare(a.last_run_at ?? ''))[0]

  const record = newest?.sample?.[0]

  return (
    <>
      <Nav />

      {/* hero */}
      <section className="relative overflow-hidden border-b border-gutter">
        <div className="grid-field grid-fade absolute inset-0 -z-10" />
        
        <div className="mx-auto grid max-w-page items-center gap-12 px-6 pt-20 pb-20 sm:pt-28 sm:pb-28 lg:grid-cols-[1fr_480px]">
          {/* left column — copy */}
          <div>
            <p className="rise font-mono text-micro tracking-[0.14em] text-web uppercase">
              Scraper Studio lifecycle, over MCP
            </p>

            <h1 className="rise mt-6 font-display text-[clamp(2.4rem,6vw,5.5rem)] leading-[0.98] tracking-[-0.03em]">
              Scrapers that
              <br />
              <em className="italic">repair themselves.</em>
            </h1>

            <p className="rise mt-6 max-w-[52ch] text-[clamp(1rem,1.7vw,1.3rem)] leading-relaxed text-muted">
              Every scraping tutorial ends when the scraper runs. This one starts
              when it breaks. Point your coding agent at any public page — it
              builds the scraper, notices when the site changes underneath it,
              repairs it, and runs it again to prove the repair worked.
            </p>

            <div className="rise mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-full bg-ink px-6 py-3 text-lead font-medium text-white transition-opacity hover:opacity-85"
              >
                Connect your agent
              </Link>
              <Link
                href="/submission"
                className="rounded-full border border-gutter bg-surface px-6 py-3 text-lead transition-colors hover:border-ink"
              >
                See it running live →
              </Link>
            </div>

            {stats.scrapers > 0 && (
              <p className="rise mt-8 inline-flex items-center gap-2.5 rounded-full border border-gutter bg-surface px-4 py-2 text-body text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-verified pulse" />
                {stats.scrapers} {stats.scrapers === 1 ? 'scraper' : 'scrapers'}
                {' · '}
                {stats.rows.toLocaleString()} rows
                {' · '}
                last run {ago(stats.last_run_at)}
              </p>
            )}
          </div>

          {/* right column — logo graphic */}
          <div className="rise mx-auto w-full max-w-[500px] lg:max-w-none">
            <HeroGraphic />
          </div>
        </div>
      </section>

      {/* the product shot: one real record */}
      {record && (
        <section className="mx-auto mt-20 max-w-3xl px-6 sm:mt-28">
          <div className="text-center">
            <h2 className="font-display text-[clamp(1.9rem,4vw,3.05rem)] tracking-[-0.02em]">
              This came back a moment ago.
            </h2>
            <p className="mx-auto mt-3 max-w-[52ch] text-sub text-muted">
              Pulled live from {newest.domain} by the scheduled run — not a
              mockup.
            </p>
          </div>

          <div className="mt-9">
            <RecordCard record={record} />
          </div>

          {newest.schema_baseline.length > 0 && (
            <div className="mt-9 text-center">
              <p className="text-body text-faint">Fields under watch</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {newest.schema_baseline.map(field => (
                  <li
                    key={field}
                    className="rounded-full bg-web-soft px-3 py-1.5 font-mono text-meta text-web"
                  >
                    {field}
                  </li>
                ))}
              </ul>
              <p className="mx-auto mt-4 max-w-[48ch] text-body text-faint">
                If any of these stops coming back, the scraper is considered
                broken and a repair starts on its own.
              </p>
            </div>
          )}
        </section>
      )}

      {/* the loop */}
      <section className="mx-auto mt-28 max-w-column px-6 sm:mt-36">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-display text-[clamp(1.9rem,4vw,3.05rem)] leading-[1.08] tracking-[-0.02em]">
              What happens on every run
            </h2>
            <p className="mt-4 text-sub text-muted">
              One call does all of it. The order matters, so it is worth being
              precise about.
            </p>
          </div>

          <ol className="relative">
            <span className="absolute top-2 bottom-2 left-[13px] w-px bg-gutter" />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative pb-10 pl-12 last:pb-0">
                <span className="absolute top-0 left-0 flex h-[27px] w-[27px] items-center justify-center rounded-full border border-gutter bg-surface font-mono text-micro text-web">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-sub font-semibold tracking-[-0.018em]">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[54ch] text-lead leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* close */}
      <section className="mx-auto mt-28 max-w-3xl px-6 pb-28 text-center sm:mt-36">
        <h2 className="font-display text-[clamp(1.9rem,4vw,3.05rem)] tracking-[-0.02em]">
          It all runs from your agent.
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-sub text-muted">
          The dashboard only shows what happened. Everything that does anything
          is an MCP tool, so it works from Claude Code, Claude Desktop, or any
          MCP client.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-lead font-medium text-white transition-opacity hover:opacity-85"
        >
          Get your config
        </Link>
      </section>

      <footer className="border-t border-gutter">
        <div className="mx-auto max-w-column px-6 py-10 text-body text-muted">
          <p>
            A fork of Bright Data’s official MCP server, extended with the
            Scraper Studio lifecycle. Built for Into the Scrape-Verse
            (WeMakeDevs × Bright Data), August 2026.
          </p>
          <p className="mt-2.5 text-faint">
            Upstream server, browser tools and dataset tools are Bright Data’s,
            MIT licensed. The lifecycle, registry, health checks and this
            dashboard are ours. Built with AI assistance.
          </p>
        </div>
      </footer>
    </>
  )
}
