// Reads the rows a run actually collected.
//
// The registry holds three records as a preview; the real output goes to
// brightdata-mcp-studio/data/<domain>/latest.json, overwritten on every
// healthy run and committed by the cron. Until now nothing in the interface
// showed it, so the product's actual output — structured rows off a live site
// — was the one thing you could not see.
//
// Only healthy runs are stored, deliberately: nobody reading latest.json
// should have to ask whether the data in it was any good. So this file is
// never the source for counts or health. The registry stays authoritative for
// both. This answers one question only: what are the rows?

import fs from 'node:fs'
import path from 'node:path'
import { raw_url, LOCAL_ROOT } from '@/lib/repo'
import { without_input, type ScrapedRecord } from '@/lib/registry'

export interface Dataset {
  records: ScrapedRecord[]
  total: number
  // The public file itself. Anything that can make an HTTP request can consume
  // the pipeline through this URL, with no key and no API.
  url: string
}

// How many rows the table renders. lobste.rs alone returns 125; the point is
// to show the shape and prove it is real, and the link carries the rest.
const SHOWN = 25

function parse(text: string, url: string): Dataset | null {
  const body: unknown = JSON.parse(text)
  if (!Array.isArray(body) || body.length === 0)
    return null

  const records = body as ScrapedRecord[]
  return {
    records: records.slice(0, SHOWN).map(without_input),
    total: records.length,
    url,
  }
}

// `domain` must come from a registry key that has already been matched, never
// from a raw URL segment — it is used to build a filesystem path.
export async function load_dataset(domain: string): Promise<Dataset | null> {
  const url = raw_url('data', domain, 'latest.json')
  const local = path.join(process.cwd(), ...LOCAL_ROOT, 'data', domain, 'latest.json')

  try {
    if (fs.existsSync(local))
      return parse(fs.readFileSync(local, 'utf8'), url)
  } catch {
    // a malformed working copy should not hide the committed one
  }

  try {
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok)
      return null
    return parse(await res.text(), url)
  } catch {
    return null
  }
}
