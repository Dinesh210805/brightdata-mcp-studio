import { McpConfig } from '@/components/mcp-config'
import { DeviceFlowPanel } from './device-flow'
import { ApiKeyForm } from './api-key-form'
import { ago } from '@/lib/format'

// Setup, sized to how much of it is left.
//
// Onboarding is something you do once, so it should shrink to nothing when it
// is done and expand to everything when it is not. Three states, and the
// dashboard around it is visible in all of them — a new account lands on a
// dashboard, not on a form.

interface ConnectProps {
  has_key: boolean
  api_key: string | null
  last_sync: string | null
}

function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-gutter pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink font-mono text-[10.5px] text-paper">
          {n}
        </span>
        <h3 className="font-display text-[15.5px] font-[700] tracking-[-0.02em]">
          {title}
        </h3>
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  )
}

export function Connect({ has_key, api_key, last_sync }: ConnectProps) {
  // Done. One line, and it gets out of the way.
  if (has_key && last_sync) {
    return (
      <section className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gutter pt-5 font-mono text-[11.5px] text-faint">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-verified" />
        your agent checked in {ago(last_sync)}
        <a href="/app/settings" className="underline-offset-4 hover:text-ink hover:underline">
          view config
        </a>
      </section>
    )
  }

  // Key saved, but the MCP server has never spoken to us. This is the silent
  // failure mode of MCP onboarding — the config is pasted, the client is not
  // restarted, and nothing tells anybody. So something has to.
  if (has_key) {
    return (
      <section className="panel border-web/30 bg-web-soft p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-[16px] font-[800] tracking-[-0.02em] text-ink">
              Your agent has not checked in yet
            </h2>
            <p className="mt-1.5 max-w-[56ch] text-[14px] leading-relaxed text-muted">
              Paste the config below into your MCP client and restart it. This
              panel turns green the moment the server reports its first run.
            </p>
          </div>
          <span className="pulse inline-block h-2 w-2 shrink-0 rounded-full bg-web" />
        </div>
        <div className="mt-5">
          <McpConfig api_key={api_key} />
        </div>
      </section>
    )
  }

  // Nothing connected. The only live thing on an otherwise dormant page.
  return (
    <section className="panel-loud p-6 sm:p-8">
      <p className="font-mono text-[10.5px] tracking-[0.14em] text-faint uppercase">
        Setup
      </p>
      <h2 className="mt-3 font-display text-[clamp(1.5rem,3.4vw,2.1rem)] font-[900] tracking-[-0.035em]">
        Connect your agent.
      </h2>
      <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-muted">
        Everything this product does is an MCP tool, so the real install is a
        config block landing in your client. Two minutes, once.
      </p>

      <div className="mt-8 space-y-6">
        <Step n={1} title="Connect Bright Data">
          <DeviceFlowPanel has_key={has_key} />
          <details className="mt-4">
            <summary className="cursor-pointer text-[13px] text-faint hover:text-ink">
              or paste an API key instead
            </summary>
            <ApiKeyForm has_key={has_key} />
          </details>
        </Step>

        <Step n={2} title="Copy this into your MCP client">
          <McpConfig api_key={api_key} />
        </Step>

        <Step n={3} title="Ask your agent for data">
          <p className="rounded-sm border border-gutter bg-raised px-5 py-4 font-mono text-[13px] leading-relaxed">
            Use scraper_ensure to get the top stories from
            news.ycombinator.com — title, points and author.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-faint">
            Building a scraper for a site it has never seen takes 5–10 minutes,
            once. Every run after that reuses it and takes seconds.
          </p>
        </Step>
      </div>
    </section>
  )
}
