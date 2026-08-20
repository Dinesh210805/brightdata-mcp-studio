// The scrapers Bright Data thinks exist, read live with the signed-in
// person's own key.
//
// The registry is the only place a scraper is tied to the site it targets -
// Bright Data can list the collectors on an account, but not say what any of
// them is for. So the two views answer different questions, and the gap
// between them is the interesting part: a collector the account has but the
// registry does not is an orphan, almost always left behind by a rebuild.
//
// Fails quietly, like the balance lookup. A dashboard that will not render
// because a live call timed out is worse than one missing a section.

const API_BASE = 'https://api.brightdata.com'

export interface Collector {
  id: string
  name: string | null
  active: boolean
  last_run: string | null
}

export interface CollectorView extends Collector {
  // The site this collector scrapes, when the registry knows. Null means
  // nothing on this account records what it was for.
  domain: string | null
}

interface RawCollector {
  id?: string
  collector?: string
  name?: string
  active?: boolean
  last_run?: string
}

// `id` is what the endpoint returns; `collector` is what the run endpoints
// call the same value. Accept either rather than render a list of blanks.
function normalize(raw: RawCollector): Collector | null {
  const id = raw.id ?? raw.collector
  if (!id)
    return null
  return {
    id,
    name: raw.name ?? null,
    active: raw.active !== false,
    last_run: raw.last_run ?? null,
  }
}

export async function load_collectors(
  api_key: string | null,
): Promise<Collector[] | null> {
  if (!api_key)
    return null

  try {
    const res = await fetch(`${API_BASE}/dca/collectors_list`, {
      headers: { Authorization: `Bearer ${api_key}` },
      cache: 'no-store',
    })
    if (!res.ok)
      return null

    // Verified against the live endpoint: {total, offset, limit, data[]}.
    // The array fallback is kept because this is an undocumented surface and
    // a shape change should degrade to an empty section, not a crash.
    const body: unknown = await res.json()
    const list = Array.isArray(body)
      ? body
      : (body as { data?: RawCollector[] })?.data
    if (!Array.isArray(list))
      return null

    return list.map(normalize).filter((c): c is Collector => c !== null)
  } catch {
    return null
  }
}

// Joins the live list against the registry. Sorted so the ones nothing
// accounts for surface first — they are the ones costing money for nothing.
export function to_collector_view(
  collectors: Collector[],
  owned: Map<string, string>,
): CollectorView[] {
  return collectors
    .map(c => ({ ...c, domain: owned.get(c.id) ?? null }))
    .sort((a, b) => {
      if ((a.domain === null) !== (b.domain === null))
        return a.domain === null ? -1 : 1
      return (a.domain ?? a.id).localeCompare(b.domain ?? b.id)
    })
}
