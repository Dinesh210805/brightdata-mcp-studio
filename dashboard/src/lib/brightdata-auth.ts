'use server'

import { revalidatePath } from 'next/cache'
import { create_client, current_user } from '@/lib/supabase/server'

// The Bright Data device flow, ported from the CLI's src/utils/browser_auth.ts.
// Bright Data has no third-party OAuth, so the only way for a dashboard user
// to get a key without hunting through the console is this: the dashboard asks
// for a device code, the user approves it on Bright Data's website, and the
// dashboard polls until the key is handed back.
const DEVICE_START_URL = 'https://brightdata.com/users/auth/cli/device/start'
const DEVICE_TOKEN_URL = 'https://brightdata.com/users/auth/cli/device/token'
const API_BASE = 'https://api.brightdata.com'

const UA = 'brightdata-dashboard'

export type FlowState =
  | { status: 'none' }
  | { status: 'pending'; user_code: string; verification_uri: string; interval: number }
  | { status: 'done' }
  | { status: 'expired'; message: string }
  | { status: 'failed'; message: string }

interface DeviceStartResponse {
  device_code?: string
  user_code?: string
  verification_uri?: string
  interval?: number
  expires_in?: number
  error?: string
  error_description?: string
}

interface DeviceTokenResponse {
  api_key?: string
  error?: string
  error_description?: string
}

type Raw = { raw?: string }

async function post_json<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: (T & Raw) | null }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
    // Bright Data's auth host is a website, not an API — some failures answer
    // with a 302 to a login page. Following it turns an error into an HTTP 200
    // full of HTML, which reads downstream as "no api_key in the response" and
    // silently kills a flow that was only ever going to need another poll.
    redirect: 'manual',
  })

  // Read as text first and keep the body when it is not JSON. This endpoint is
  // undocumented, so the first 300 characters of an unexpected response is
  // usually the entire difference between a diagnosis and a guess.
  const text = await res.text()
  if (!text)
    return { status: res.status, json: null }

  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      return { status: res.status, json: parsed as T & Raw }
  } catch {
    // not JSON — fall through and keep the raw body
  }
  return { status: res.status, json: { raw: text } as T & Raw }
}

function describe_error(
  status: number,
  json: (DeviceStartResponse | DeviceTokenResponse) & Raw | null,
): string {
  // A Bright Data account that belongs to several customers cannot pick one
  // over the device flow, so point at the fallback rather than dead-ending.
  if (json?.error === 'multi_customer') {
    return 'Your Bright Data login covers more than one account, which this '
      + 'sign-in cannot choose between. Paste an API key below instead.'
  }

  const detail = json?.error_description ?? json?.error ?? ''
  if (detail)
    return `Bright Data: ${detail}`
  if (status === 429)
    return 'Rate limited by Bright Data. Wait a moment and try again.'

  const raw = json?.raw ? ` Server said: ${json.raw.slice(0, 300)}` : ''
  return `Bright Data request failed (HTTP ${status}). Try again.${raw}`
}

async function validate_key(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/zone`, {
      headers: { Authorization: `Bearer ${key}`, 'User-Agent': UA },
    })
    return res.status !== 401 && res.status !== 403
  } catch {
    return false
  }
}

export async function start_device_flow(): Promise<FlowState> {
  const supabase = await create_client()
  const user = await current_user()
  if (!supabase || !user)
    return { status: 'failed', message: 'Sign in again to connect Bright Data.' }

  const { status, json } = await post_json<DeviceStartResponse>(DEVICE_START_URL, {})
  if (status >= 400 || !json?.device_code || !json?.user_code || !json?.verification_uri) {
    return { status: 'failed', message: describe_error(status, json) }
  }

  const interval = typeof json.interval === 'number' && json.interval > 0 ? json.interval : 5
  const expires_in = typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 900

  const { error } = await supabase
    .from('device_flows')
    .upsert(
      {
        user_id: user.id,
        device_code: json.device_code,
        user_code: json.user_code,
        verification_uri: json.verification_uri,
        interval_seconds: interval,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error)
    return { status: 'failed', message: error.message }

  return { status: 'pending', user_code: json.user_code, verification_uri: json.verification_uri, interval }
}

export async function poll_device_flow(): Promise<FlowState> {
  const supabase = await create_client()
  const user = await current_user()
  if (!supabase || !user)
    return { status: 'failed', message: 'Sign in again to connect Bright Data.' }

  const { data: flow } = await supabase
    .from('device_flows')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!flow)
    return { status: 'none' }

  if (new Date(flow.expires_at).getTime() <= Date.now()) {
    await supabase.from('device_flows').delete().eq('user_id', user.id)
    return { status: 'expired', message: 'The login link expired. Start again.' }
  }

  const pending = (interval: number): FlowState => ({
    status: 'pending',
    user_code: flow.user_code,
    verification_uri: flow.verification_uri,
    interval,
  })

  // The browser drives the polling, so without this a stuck tab, a duplicate
  // mount or a hostile client could hammer Bright Data from our server's IP -
  // and the rate limit that follows lands on every user, not just that one.
  // A little under the interval, so an honest client's timer is never punished
  // for arriving a few milliseconds early.
  const since_last = Date.now() - new Date(flow.last_polled_at ?? 0).getTime()
  if (since_last < flow.interval_seconds * 800)
    return pending(flow.interval_seconds)

  await supabase
    .from('device_flows')
    .update({ last_polled_at: new Date().toISOString() })
    .eq('user_id', user.id)

  const { status, json } = await post_json<DeviceTokenResponse>(DEVICE_TOKEN_URL, { device_code: flow.device_code })

  if (status < 400 && typeof json?.api_key === 'string' && json.api_key.trim()) {
    if (!(await validate_key(json.api_key)))
      return { status: 'failed', message: 'Bright Data returned a key that failed validation. Try again.' }

    const { error } = await supabase
      .from('profiles')
      .update({ brightdata_key: json.api_key, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    await supabase.from('device_flows').delete().eq('user_id', user.id)

    if (error)
      return { status: 'failed', message: error.message }

    revalidatePath('/app')
    return { status: 'done' }
  }

  const error = json?.error
  if (error === 'authorization_pending')
    return pending(flow.interval_seconds)

  // Persist the backoff. Returning a longer interval without writing it means
  // the next poll reads the old value again, so repeated slow_down responses
  // never compound and we keep asking at a rate Bright Data already refused.
  if (error === 'slow_down') {
    const slower = flow.interval_seconds + 5
    await supabase
      .from('device_flows')
      .update({ interval_seconds: slower })
      .eq('user_id', user.id)
    return pending(slower)
  }

  await supabase.from('device_flows').delete().eq('user_id', user.id)
  return { status: 'failed', message: describe_error(status, json) }
}

export async function cancel_device_flow(): Promise<void> {
  const supabase = await create_client()
  const user = await current_user()
  if (!supabase || !user)
    return
  await supabase.from('device_flows').delete().eq('user_id', user.id)
}