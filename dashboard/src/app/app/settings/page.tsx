import { redirect } from 'next/navigation'
import { Bar } from '@/components/app/bar'
import { McpConfig } from '@/components/mcp-config'
import { DeviceFlowPanel } from '@/components/app/device-flow'
import { ApiKeyForm } from '@/components/app/api-key-form'
import { auth_configured, current_user } from '@/lib/supabase/server'
import { get_profile, sign_out } from '@/lib/profile'

export const metadata = { title: 'Settings — Bright Data MCP Studio' }
export const dynamic = 'force-dynamic'

export default async function Settings() {
  if (!auth_configured())
    redirect('/login')

  const user = await current_user()
  if (!user)
    redirect('/login')

  const profile = await get_profile()
  const has_key = Boolean(profile?.brightdata_key)

  return (
    <>
      <Bar email={profile?.email ?? user.email} />

      <main className="mx-auto max-w-3xl space-y-12 px-6 pt-14 pb-24">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[clamp(1.8rem,4.5vw,3.05rem)] leading-[1] font-[900] tracking-[-0.04em]">
              Settings
            </h1>
            <p className="mt-2.5 font-mono text-meta text-faint">
              {profile?.email ?? user.email}
            </p>
          </div>
          <form action={sign_out}>
            <button
              type="submit"
              className="rounded-sm border border-gutter px-4 py-2 text-body text-muted transition-colors hover:border-ink hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </header>

        <section>
          <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
            Bright Data connection
          </h2>
          <div className="panel mt-5 p-6">
            <DeviceFlowPanel has_key={has_key} />
            <details className="mt-4">
              <summary className="cursor-pointer text-body text-faint hover:text-ink">
                or paste an API key instead
              </summary>
              <ApiKeyForm has_key={has_key} />
            </details>
            <p className="mt-5 border-t border-gutter pt-5 text-body leading-relaxed text-faint">
              Your key is stored against your account with row-level security
              and is sent only to Bright Data. It never appears in a tool
              response or a log.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-body font-[700] tracking-[0.14em] text-faint uppercase">
            Your MCP config
          </h2>
          <div className="mt-5">
            <McpConfig api_key={profile?.brightdata_key ?? null} />
          </div>
        </section>
      </main>
    </>
  )
}
