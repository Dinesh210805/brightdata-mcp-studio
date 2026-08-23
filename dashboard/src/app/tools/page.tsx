import Link from 'next/link'
import { Nav } from '@/components/nav'
import { Bar } from '@/components/app/bar'
import { ToolCatalog } from '@/components/tool-catalog'
import { TOOL_GROUPS, total_tool_count, ours_tool_count } from '@/lib/tools'
import { auth_configured, current_user } from '@/lib/supabase/server'

export const metadata = { title: 'Tools — Bright Data MCP Studio' }
export const dynamic = 'force-dynamic'

// One page, every tool this server exposes — the ones Bright Data shipped and
// the ones this fork added. A judge (or a coding agent's user) should be able
// to answer "what can I actually ask it to do" without reading source.
//
// Reachable from both the marketing site and the signed-in app, so it wears
// whichever chrome the viewer is already in rather than always looking like a
// page that escaped from the landing site.
export default async function ToolsPage() {
  const signed_in = auth_configured() && Boolean(await current_user())
  const total = total_tool_count()
  const ours = ours_tool_count()

  return (
    <>
      {signed_in ? <Bar /> : <Nav />}

      <section className="border-b border-gutter">
        <div className="mx-auto max-w-page px-6 pt-16 pb-12 sm:pt-20">
          <p className="rise font-mono text-micro tracking-[0.14em] text-web uppercase">
            MCP tool reference
          </p>
          <h1 className="rise mt-5 font-display text-[clamp(2.1rem,5vw,4rem)] leading-[1] font-[900] tracking-[-0.03em]">
            Everything your agent can call.
          </h1>
          <p className="rise mt-5 max-w-[62ch] text-sub leading-relaxed text-muted">
            {total} tools, one MCP connection. {ours} of them — the Scraper
            Studio lifecycle and the account tools — are this fork’s own;
            the rest are Bright Data’s upstream server, unchanged.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3">
            <Link
              href="/app/settings"
              className="rounded-full bg-ink px-5 py-2.5 text-body font-medium text-paper transition-opacity hover:opacity-85"
            >
              Get your MCP config
            </Link>
            <a
              href="https://github.com/brightdata/brightdata-mcp"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-gutter px-5 py-2.5 text-body text-muted transition-colors hover:border-ink hover:text-ink"
            >
              Upstream repo ↗
            </a>
          </div>
        </div>
      </section>

      <ToolCatalog groups={TOOL_GROUPS} />

      <footer className="border-t border-gutter">
        <div className="mx-auto max-w-page px-6 py-10 text-body text-faint">
          Descriptions are copied from the server’s own tool definitions —
          this page says nothing the tool itself doesn’t already say.
        </div>
      </footer>
    </>
  )
}
