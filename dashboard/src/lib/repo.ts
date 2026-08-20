// Which repository the dashboard is looking at.
//
// The scraper's own outputs — registry.json and every data/<domain> file — are
// committed back by the cron, so the repo *is* the deployed dashboard's
// database. That made the slug easy to hardcode and easy to hardcode three
// times. It lives here now, and anybody forking this sets one env var instead
// of grepping for a username.

export const REPO =
  process.env.NEXT_PUBLIC_REPO ?? 'Dinesh210805/brightdata-mcp-studio'

const WORKFLOW = 'scrape.yml'

export const ACTIONS_URL =
  `https://github.com/${REPO}/actions/workflows/${WORKFLOW}`
export const COMMITS_URL = `https://github.com/${REPO}/commits/main`
export const RUNS_API_URL =
  `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs`

// Anything the cron committed, readable with no token and no account. This is
// the whole reason results are written as files rather than rows in a database.
export function raw_url(...segments: string[]): string {
  return `https://raw.githubusercontent.com/${REPO}/main/`
    + ['brightdata-mcp-studio', ...segments].join('/')
}

// Development reads the working copy so a run shows up the moment it finishes;
// deployed, this path does not exist and the committed copy is the source.
export const LOCAL_ROOT = ['..', 'brightdata-mcp-studio']
