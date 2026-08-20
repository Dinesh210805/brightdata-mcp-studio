// The unattended half of the project, read straight from GitHub.
//
// The cron is the claim under test — a scraper that repairs itself with nobody
// watching — and the run history is the evidence. Linking to the Actions tab
// asks the reader to go and verify it; rendering the runs here shows them. The
// endpoint is public, so this costs no token and no infrastructure.

import { RUNS_API_URL } from '@/lib/repo'

export interface WorkflowRun {
  id: number
  run_number: number
  status: string
  conclusion: string | null
  created_at: string
  html_url: string
}

export { ACTIONS_URL, COMMITS_URL } from '@/lib/repo'

export async function load_runs(limit = 20): Promise<WorkflowRun[]> {
  const url = `${RUNS_API_URL}?per_page=${limit}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      // Unauthenticated GitHub allows 60 requests an hour per IP. Caching for
      // five minutes keeps a busy dashboard well inside that.
      next: { revalidate: 300 },
    })
    if (!res.ok)
      return []
    const body = await res.json() as { workflow_runs?: WorkflowRun[] }
    return body.workflow_runs ?? []
  } catch {
    return []
  }
}

// The cron is `0 */6 * * *`, so the next run is the next UTC hour divisible by
// six. Computed rather than stored, which means it cannot drift out of sync
// with the workflow file.
export function next_cron_run(from = new Date()): Date {
  const next = new Date(from)
  next.setUTCMinutes(0, 0, 0)
  next.setUTCHours(Math.floor(from.getUTCHours() / 6) * 6 + 6)
  return next
}
