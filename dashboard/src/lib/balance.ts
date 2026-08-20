// Account balance, read with the signed-in person's own Bright Data key.
//
// Every AI build and every scheduled run spends credit, so this is the one
// number that tells somebody whether the thing they just set up can keep
// running. It fails quietly on purpose: a dashboard that will not render
// because a balance lookup timed out is worse than one missing a number.

const API_BASE = 'https://api.brightdata.com'

export async function load_balance(api_key: string | null): Promise<number | null> {
  if (!api_key)
    return null

  try {
    const res = await fetch(`${API_BASE}/customer/balance`, {
      headers: { Authorization: `Bearer ${api_key}` },
      cache: 'no-store',
    })
    if (!res.ok)
      return null
    const body = await res.json() as { balance?: number }
    return typeof body.balance === 'number' ? body.balance : null
  } catch {
    return null
  }
}
