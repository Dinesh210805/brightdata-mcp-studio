'use client'

import { useState } from 'react'
import { create_browser_client } from '@/lib/supabase/client'

export function SignInButton() {
  const [busy, set_busy] = useState(false)
  const [error, set_error] = useState<string | null>(null)

  async function sign_in() {
    const supabase = create_browser_client()
    if (!supabase) {
      set_error('Sign-in is not configured on this deployment.')
      return
    }

    set_busy(true)
    set_error(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })

    if (error) {
      set_error(error.message)
      set_busy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={sign_in}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-full bg-ink px-5 py-3.5 text-[15px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#fff" d="M12 11v3.2h5.3a4.6 4.6 0 0 1-1.98 3l3.2 2.5c1.87-1.73 2.95-4.28 2.95-7.3 0-.7-.06-1.38-.18-2.03H12z" />
          <path fill="#fff" opacity=".75" d="M6.6 14.3 5.9 14.9l-2.55 2a9.9 9.9 0 0 0 8.65 5.1c2.67 0 4.92-.88 6.56-2.4l-3.2-2.5c-.88.6-2 .95-3.36.95a5.85 5.85 0 0 1-5.4-4z" />
          <path fill="#fff" opacity=".5" d="M3.35 7.1A9.83 9.83 0 0 0 2.3 12c0 1.77.42 3.44 1.05 4.9l3.28-2.6a5.9 5.9 0 0 1 0-3.76z" />
          <path fill="#fff" opacity=".85" d="M12 5.9c1.5 0 2.85.52 3.9 1.53l2.9-2.9A9.76 9.76 0 0 0 12 2a9.9 9.9 0 0 0-8.65 5.1l3.28 2.54A5.85 5.85 0 0 1 12 5.9z" />
        </svg>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>

      {error && (
        <p className="mt-3 text-center text-[13.5px] text-venom">{error}</p>
      )}
    </>
  )
}
