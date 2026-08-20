// Reads the registry that the MCP tools and the scheduled cron both write.
//
// The registry is the only place the site -> scraper mapping exists: Bright
// Data has no API that lists the collectors on an account. The cron commits it
// back to the repo on every run, so reading it from GitHub gives the dashboard
// the same file the last unattended run produced.

import fs from 'node:fs'
import path from 'node:path'

export type ScrapedRecord = Record<string, unknown>

export interface HealEvent {
  timestamp: string
  prompt?: string
  status?: string
  auto_triggered?: boolean
  escalated?: boolean
  replaced_by?: string | null
}

// One run. Written for every run, including the failed ones — the baseline
// fields below are only updated on a healthy run by design, so without this a
// break would leave no trace and there would be nothing to plot.
export interface RunPoint {
  at: string
  rows: number
  healthy: boolean
  fields: string[]
}

export interface RegistryEntry {
  collector_id: string
  name?: string
  source_url: string
  description: string
  created_at: string
  status: 'active' | 'abandoned'
  schema_baseline?: string[] | null
  last_sample?: ScrapedRecord[] | null
  last_run_at?: string
  last_row_count?: number
  heal_history?: HealEvent[]
  run_history?: RunPoint[]
}

export type Registry = Record<string, RegistryEntry>

// What the interface actually reacts to. `drifting` is the state the whole
// product exists to catch: the run succeeded, the rows came back, and the
// values are missing.
export type ScraperState = 'healthy' | 'drifting' | 'abandoned'

export interface RegistryRow {
  domain: string
  collector_id: string
  description: string
  source_url: string
  status: RegistryEntry['status']
  state: ScraperState
  created_at: string
  last_run_at: string | null
  last_row_count: number | null
  schema_baseline: string[]
  missing_fields: string[]
  heal_count: number
  runs: RunPoint[]
  sample: ScrapedRecord[]
}

export interface Stats {
  scrapers: number
  abandoned: number
  drifting: number
  heals: number
  rows: number
  watching_since: string | null
  last_run_at: string | null
}

const RAW_URL =
  'https://raw.githubusercontent.com/Dinesh210805/brightdata-mcp-studio'
  + '/main/brightdata-mcp-studio/registry.json'

const LOCAL_PATH = path.join(
  process.cwd(), '..', 'brightdata-mcp-studio', 'registry.json',
)

// Local file first so development shows runs the moment they finish. Deployed,
// that path does not exist and the committed copy on GitHub is the source.
export async function load_registry(): Promise<Registry> {
  try {
    if (fs.existsSync(LOCAL_PATH))
      return JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8')) as Registry
  } catch {
    // fall through to the network copy
  }

  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 60 } })
    if (!res.ok)
      return {}
    return (await res.json()) as Registry
  } catch {
    return {}
  }
}

// Every scraped record echoes the trigger input back. The health check leaves
// it out of the schema, so showing it as an extracted field would contradict
// the model the rest of the project runs on.
function without_input(record: ScrapedRecord): ScrapedRecord {
  const { input: _input, ...fields } = record
  return fields
}

function state_of(entry: RegistryEntry, runs: RunPoint[]): ScraperState {
  if (entry.status === 'abandoned')
    return 'abandoned'
  const last = runs.at(-1)
  // No runs yet is not a fault — a scraper built a minute ago has nothing to
  // be wrong about.
  if (!last)
    return 'healthy'
  return last.healthy ? 'healthy' : 'drifting'
}

// Which baseline fields stopped coming back on the most recent run. This is
// the specific answer to "what broke", and it is what the field chips strike
// through in the mosaic.
function missing_on_last_run(
  baseline: string[],
  runs: RunPoint[],
): string[] {
  const last = runs.at(-1)
  if (!last || last.healthy)
    return []
  return baseline.filter(field => !last.fields.includes(field))
}

export function to_rows(registry: Registry): RegistryRow[] {
  return Object.entries(registry).map(([domain, entry]) => {
    const runs = entry.run_history ?? []
    const baseline = entry.schema_baseline ?? []

    return {
      domain,
      collector_id: entry.collector_id,
      description: entry.description,
      source_url: entry.source_url,
      status: entry.status,
      state: state_of(entry, runs),
      created_at: entry.created_at,
      last_run_at: entry.last_run_at ?? runs.at(-1)?.at ?? null,
      last_row_count: entry.last_row_count ?? runs.at(-1)?.rows ?? null,
      schema_baseline: baseline,
      missing_fields: missing_on_last_run(baseline, runs),
      heal_count: (entry.heal_history ?? []).length,
      runs,
      sample: (entry.last_sample ?? []).map(without_input),
    }
  })
}

// Flattened across sites so the dashboard shows one repair timeline for the
// whole system rather than a log per site.
export function to_heals(registry: Registry): (HealEvent & { domain: string })[] {
  return Object.entries(registry)
    .flatMap(([domain, entry]) =>
      (entry.heal_history ?? []).map(event => ({ ...event, domain })))
    .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
}

export function to_stats(registry: Registry): Stats {
  const rows = to_rows(registry)
  const active = rows.filter(r => r.state !== 'abandoned')
  const created = active.map(r => r.created_at).filter(Boolean).sort()
  const runs = active.map(r => r.last_run_at).filter(Boolean).sort() as string[]

  return {
    scrapers: active.length,
    abandoned: rows.length - active.length,
    drifting: active.filter(r => r.state === 'drifting').length,
    heals: rows.reduce((n, r) => n + r.heal_count, 0),
    rows: active.reduce((n, r) => n + (r.last_row_count ?? 0), 0),
    watching_since: created[0] ?? null,
    last_run_at: runs[runs.length - 1] ?? null,
  }
}
