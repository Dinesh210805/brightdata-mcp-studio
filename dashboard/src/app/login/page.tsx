import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Nav } from '@/components/nav'
import { auth_configured, current_user } from '@/lib/supabase/server'
import { SignInButton } from './sign-in-button'

export const metadata = { title: 'Sign in — Bright Data MCP Studio' }

export default async function Login() {
  const user = await current_user()
  if (user)
    redirect('/app')

  const configured = auth_configured()

  return (
    <>
      <Nav />

      <main className="relative overflow-hidden">
        <div className="grid-field grid-fade absolute inset-0 -z-10" />

        <div className="mx-auto max-w-md px-6 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="font-display text-[clamp(2.2rem,5vw,3rem)] leading-[1.05] tracking-[-0.028em]">
              Connect your agent.
            </h1>
            <p className="mx-auto mt-4 max-w-[38ch] text-[16px] leading-relaxed text-muted">
              Signing in gives you a ready-to-paste MCP config and lets us email
              you when one of your scrapers breaks and repairs itself.
            </p>
          </div>

          <div className="mt-10 rounded-sm border border-gutter bg-surface p-7 ">
            {configured ? (
              <SignInButton />
            ) : (
              <div className="rounded-xl border border-dashed border-gutter px-5 py-6 text-center">
                <p className="text-[15px] font-semibold">
                  Sign-in is not configured
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Add <code className="font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
                  and{' '}
                  <code className="font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
                  to <code className="font-mono text-[13px]">.env.local</code>,
                  then enable Google in the Supabase dashboard.
                </p>
              </div>
            )}

            <p className="mt-5 border-t border-gutter pt-5 text-[13px] leading-relaxed text-faint">
              Bright Data does not offer OAuth for third-party apps, so your
              Bright Data API key is pasted in once after signing in. It is
              stored against your account and sent only to Bright Data.
            </p>
          </div>

          <p className="mt-7 text-center text-[14px] text-muted">
            Just here to judge?{' '}
            <Link href="/submission" className="text-web hover:underline">
              The submission dashboard needs no account
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  )
}
