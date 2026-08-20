import { redirect } from 'next/navigation'
import { Bar } from '@/components/app/bar'
import { Feed } from '@/components/app/feed'
import { auth_configured, current_user } from '@/lib/supabase/server'
import { load_registry, to_stats } from '@/lib/registry'
import { to_feed } from '@/lib/derive'

export const metadata = { title: 'Repairs — Bright Data MCP Studio' }
export const dynamic = 'force-dynamic'

// Repairs get their own route because self-healing is the thing this project
// is actually judged on. Rendered as a column in a table with a pill in it,
// the feature disappears; rendered as a page where each repair reads as a
// narrative, it is the submission.
export default async function Repairs() {
  if (!auth_configured() || !await current_user())
    redirect('/login')

  const registry = await load_registry()
  const stats = to_stats(registry)
  const heals = to_feed(registry, 200).filter(e => e.kind === 'heal')

  return (
    <>
      <Bar alert={stats.drifting > 0} />

      <main className="mx-auto max-w-4xl px-6 pt-14 pb-24">
        <h1 className="font-display text-[clamp(2rem,5vw,3.55rem)] leading-[1] font-[900] tracking-[-0.04em]">
          Every repair, in full.
        </h1>
        <p className="mt-4 max-w-[60ch] text-sub leading-relaxed text-muted">
          What broke, the exact words sent to Bright Data to fix it, and
          whether a second run proved the fix held. A repair reports success
          when its AI job finishes, not when the data is correct — so the
          verifying run is the only part that counts.
        </p>

        <div className="mt-14">
          <Feed events={heals} />
        </div>
      </main>
    </>
  )
}
