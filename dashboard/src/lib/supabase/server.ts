import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Auth is optional at build time: the site has to render for anyone who
// clones it without a Supabase project. When the keys are absent every
// caller sees "signed out" rather than a crash.
export function auth_configured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function create_client() {
  if (!auth_configured())
    return null

  const store = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll()
        },
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) =>
              store.set(name, value, options))
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // proxy.ts refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}

export async function current_user() {
  const supabase = await create_client()
  if (!supabase)
    return null
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}
