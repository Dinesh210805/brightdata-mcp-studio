'use server'

import { revalidatePath } from 'next/cache'
import { create_client, current_user } from '@/lib/supabase/server'

export interface Profile {
  email: string | null
  brightdata_key: string | null
  notify_by_email: boolean
}

export async function get_profile(): Promise<Profile | null> {
  const supabase = await create_client()
  if (!supabase)
    return null

  const user = await current_user()
  if (!user)
    return null

  const { data } = await supabase
    .from('profiles')
    .select('email, brightdata_key, notify_by_email')
    .eq('id', user.id)
    .maybeSingle()

  return {
    email: data?.email ?? user.email ?? null,
    brightdata_key: data?.brightdata_key ?? null,
    notify_by_email: data?.notify_by_email ?? true,
  }
}

export async function save_api_key(
  _prev: { error?: string; ok?: boolean } | null,
  form: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const key = String(form.get('api_key') ?? '').trim()

  if (!key)
    return { error: 'Paste your Bright Data API key first.' }
  // Bright Data keys are long opaque strings. A short value is a paste error,
  // and catching it here beats a confusing 401 on the first scrape.
  if (key.length < 20)
    return { error: 'That does not look like a Bright Data API key.' }

  const supabase = await create_client()
  const user = await current_user()
  if (!supabase || !user)
    return { error: 'Sign in again to save your key.' }

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        brightdata_key: key,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

  if (error)
    return { error: error.message }

  revalidatePath('/dashboard')
  return { ok: true }
}

export async function sign_out() {
  const supabase = await create_client()
  await supabase?.auth.signOut()
}
