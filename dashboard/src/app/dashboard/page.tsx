import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Nav } from '@/components/nav'
import { McpConfig } from '@/components/mcp-config'
import { auth_configured, current_user } from '@/lib/supabase/server'
import { get_profile, sign_out } from '@/lib/profile'
import { ApiKeyForm } from './api-key-form'
import { DeviceFlowPanel } from './device-flow'

export const metadata = { title: 'Your scrapers — Bright Data MCP Studio' }

// This page renders the signed-in person's Bright Data key into the config
// block. Rendering it per request means it can never be served from a cache
// built for somebody else.
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  if (!auth_configured()) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-lg px-6 py-28 text-center">
          <h1 className="font-display text-[2rem] tracking-[-0.025em]">
            Sign-in is not configured
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted">
            This deployment has no Supabase keys, so there are no accounts. The{' '}
            <Link href="/submission" className="text-blue hover:underline">
              submission dashboard
            </Link>{' '}
            works without one.
          </p>
        </main>
      </>
    )
  }

  const user = await current_user()
  if (!user)
    redirect('/login')

  const profile = await get_profile()
  const has_key = Boolean(profile?.brightdata_key)

  return (
    <>
      <Nav variant="app" />

      <main className="mx-auto max-w-3xl px-6 pb-28">
        <header className="flex flex-wrap items-start justify-between gap-4 pt-14">
          <div>
            <h1 className="font-display text-[clamp(2rem,4.5vw,2.8rem)] tracking-[-0.028em]">
              Connect your agent
            </h1>
            <p className="mt-2.5 text-[15.5px] text-muted">
              Signed in as {profile?.email ?? user.email}
            </p>
          </div>
          <form action={sign_out}>
            <button
              type="submit"
              className="rounded-full border border-line px-4 py-2 text-[13.5px] text-muted transition-colors hover:border-ink hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </header>

        {/* step one: the key */}
        <section className="mt-11 rounded-card border border-line bg-surface p-7 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink font-mono text-[11px] text-white">
              1
            </span>
            <h2 className="text-[17px] font-semibold tracking-[-0.018em]">
              Add your Bright Data key
            </h2>
            {has_key && (
              <span className="rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-medium text-good">
                saved
              </span>
            )}
          </div>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
            Bright Data does not offer OAuth for third-party apps, so this is a
            one-time paste. We fill it into your config below so there is
            nothing left to edit by hand.
          </p>
          <ApiKeyForm has_key={has_key} />

          <div className="mt-6 border-t border-line-soft pt-5">
            <p className="text-[13px] font-medium text-muted">
              No key handy? Sign in to Bright Data and we will fetch it for you.
            </p>
            <DeviceFlowPanel has_key={has_key} />
          </div>
        </section>

        {/* step two: the config */}
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink font-mono text-[11px] text-white">
              2
            </span>
            <h2 className="text-[17px] font-semibold tracking-[-0.018em]">
              Paste this into your MCP client
            </h2>
          </div>
          <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
            Claude Code, Claude Desktop, Cursor — anything that speaks MCP.
            Restart the client afterwards, then ask it to scrape a public page.
          </p>
          <div className="mt-5">
            <McpConfig api_key={profile?.brightdata_key ?? null} />
          </div>
        </section>

        {/* step three: use it */}
        <section className="mt-8 rounded-card border border-line bg-surface p-7 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink font-mono text-[11px] text-white">
              3
            </span>
            <h2 className="text-[17px] font-semibold tracking-[-0.018em]">
              Ask your agent for data
            </h2>
          </div>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
            One tool does the whole loop. Try something like:
          </p>
          <p className="mt-4 rounded-xl border border-line bg-raised px-5 py-4 font-mono text-[13.5px] leading-relaxed">
            Use scraper_ensure to get the top stories from
            news.ycombinator.com — title, points and author.
          </p>
          <p className="mt-4 text-[13px] leading-relaxed text-faint">
            Building a scraper for a site it has never seen takes 5–10 minutes,
            once. Every run after that reuses it and takes seconds.
          </p>
        </section>

        {/* honest about what is not here yet */}
        <section className="mt-8 rounded-card border border-dashed border-line px-7 py-7">
          <h2 className="text-[15.5px] font-semibold tracking-[-0.015em]">
            Your scrapers will appear here
          </h2>
          <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-relaxed text-muted">
            Per-account scraper tracking is the next piece of work. Today the
            registry lives beside the MCP server you run, so your scrapers are
            listed by the{' '}
            <code className="font-mono text-[13px]">scraper_registry_list</code>{' '}
            tool inside your agent. The{' '}
            <Link href="/submission" className="text-blue hover:underline">
              submission dashboard
            </Link>{' '}
            shows what that looks like against ours.
          </p>
        </section>
      </main>
    </>
  )
}
