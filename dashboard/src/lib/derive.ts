// Turns the registry into the three answers the dashboard exists to give:
// is everything OK, what changed, and what is being watched.
//
// These live apart from registry.ts because they are pure shaping — no disk,
// no network — which is also what makes them the easy part to be sure about.

import type { Registry, RegistryRow, RunPoint, Stats } from './registry'
import { to_rows } from './registry'

/* ── Is everything OK? ─────────────────────────────────────────────────── */

export interface Verdict {
  tone: 'good' | 'bad' | 'empty'
  headline: string
  broken: RegistryRow[]
}

// One sentence, in plain language. The most valuable thing a monitoring
// product can do is refuse to make somebody interpret it — if the answer is a
// number you have to compare against another number, the panel has failed.
export function to_verdict(rows: RegistryRow[]): Verdict {
  const active = rows.filter(r => r.state !== 'abandoned')
  const broken = active.filter(r => r.state === 'drifting')

  if (!active.length) {
    return {
      tone: 'empty',
      headline: 'Nothing is being watched yet.',
      broken: [],
    }
  }

  if (broken.length) {
    const subject = broken.length === 1
      ? '1 scraper has stopped'
      : `${broken.length} scrapers have stopped`
    return {
      tone: 'bad',
      headline: `${subject} returning the data it used to.`,
      broken,
    }
  }

  return {
    tone: 'good',
    headline: active.length === 1
      ? 'Your scraper is returning data.'
      : `All ${active.length} scrapers are returning data.`,
    broken: [],
  }
}

/* ── What changed? ─────────────────────────────────────────────────────── */

export type FeedEvent =
  | {
    kind: 'run'
    at: string
    domain: string
    rows: number
    healthy: boolean
  }
  | {
    kind: 'heal'
    at: string
    domain: string
    prompt?: string
    status?: string
    escalated?: boolean
    replaced_by?: string | null
  }

// Runs and repairs merged into one stream, because that is how they actually
// happened. Keeping them in separate lists is what makes a repair read as a
// table row instead of as an event.
export function to_feed(registry: Registry, limit = 40): FeedEvent[] {
  const events: FeedEvent[] = []

  for (const [domain, entry] of Object.entries(registry)) {
    for (const run of entry.run_history ?? []) {
      events.push({
        kind: 'run',
        at: run.at,
        domain,
        rows: run.rows,
        healthy: run.healthy,
      })
    }
    for (const heal of entry.heal_history ?? []) {
      events.push({
        kind: 'heal',
        at: heal.timestamp,
        domain,
        prompt: heal.prompt,
        status: heal.status,
        escalated: heal.escalated,
        replaced_by: heal.replaced_by,
      })
    }
  }

  return events
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, limit)
}

/* ── What is being watched? ────────────────────────────────────────────── */

export type Cell = 'present' | 'missing' | 'na'

export interface WatchMatrix {
  fields: string[]
  rows: { domain: string; cells: Cell[] }[]
}

// Every field under observation across every scraper, as one grid. This is the
// only place the actual mechanism becomes visible: health is decided by
// comparing a run's fields against the baseline, and nothing else in the
// interface shows that comparison happening.
export function to_watch(rows: RegistryRow[]): WatchMatrix {
  const active = rows.filter(r => r.state !== 'abandoned')

  // Shared fields first, so the columns every site has in common line up on
  // the left and the eye can scan down them.
  const frequency = new Map<string, number>()
  for (const row of active) {
    for (const field of row.schema_baseline)
      frequency.set(field, (frequency.get(field) ?? 0) + 1)
  }

  const fields = [...frequency.keys()].sort((a, b) => {
    const diff = (frequency.get(b) ?? 0) - (frequency.get(a) ?? 0)
    return diff !== 0 ? diff : a.localeCompare(b)
  })

  return {
    fields,
    rows: active.map(row => ({
      domain: row.domain,
      cells: fields.map((field): Cell => {
        if (!row.schema_baseline.includes(field))
          return 'na'
        return row.missing_fields.includes(field) ? 'missing' : 'present'
      }),
    })),
  }
}

/* ── Shared helpers ────────────────────────────────────────────────────── */

// Row counts across every scraper's history, for the halftone density behind
// the verdict. A busy day should look denser, not be described as denser.
export function total_rows_today(rows: RegistryRow[]): number {
  const since = Date.now() - 24 * 60 * 60 * 1000
  return rows.reduce((sum, row) => sum + row.runs
    .filter((r: RunPoint) => new Date(r.at).getTime() >= since)
    .reduce((n, r) => n + r.rows, 0), 0)
}

export function summarize(rows: RegistryRow[], stats: Stats): string {
  const parts = [
    `${stats.scrapers} ${stats.scrapers === 1 ? 'scraper' : 'scrapers'}`,
    `${total_rows_today(rows).toLocaleString()} rows today`,
  ]
  if (stats.heals)
    parts.push(`${stats.heals} ${stats.heals === 1 ? 'repair' : 'repairs'}`)
  if (stats.abandoned)
    parts.push(`${stats.abandoned} abandoned`)
  return parts.join('  ·  ')
}

export { to_rows }
