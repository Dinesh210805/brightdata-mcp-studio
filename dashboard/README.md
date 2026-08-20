# Dashboard

The window onto the scrapers. It shows what got built, what it collected, what
broke, and what repaired itself — for a person watching, not for a machine
consuming.

It is a separate application from the MCP server in
[`../brightdata-mcp-studio`](../brightdata-mcp-studio). The server is what your
coding agent talks to; this is what you look at. Neither one needs the other to
run.

Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Supabase for
sign-in.

---

## Where the data comes from

**There is no database of scraped results, on purpose.**

Every run writes to files in the repo, and the scheduled job commits them back:

| File | What it holds |
|---|---|
| `brightdata-mcp-studio/registry.json` | Which scraper belongs to which site, its baseline fields, every run, every repair |
| `brightdata-mcp-studio/data/<domain>/latest.json` | The rows the most recent healthy run collected |
| `brightdata-mcp-studio/data/<domain>/<timestamp>.json` | The same, kept as history |

The dashboard reads those files directly — from disk in development, and from
`raw.githubusercontent.com` once deployed. Both paths are in
[`src/lib/registry.ts`](src/lib/registry.ts) and
[`src/lib/data.ts`](src/lib/data.ts).

Two reasons it works this way. **Proof:** a bot commit every six hours, whose
diff shows a repair happening, is publicly verifiable in a way a private
database row is not. **Custody:** it keeps a user's scraped data in their own
repository instead of our infrastructure, which is how Bright Data's own
product is designed to work.

Supabase holds accounts and each user's Bright Data key. It never holds
scraped data.

CI run history comes from GitHub's public REST API
([`src/lib/actions.ts`](src/lib/actions.ts)) — no token, no rate-limit problem
at a five-minute cache.

---

## Running it

```bash
npm install
npm run dev
```

No configuration is required to see it work — every variable below is
optional, and `.env` is gitignored, so create it yourself if you want any of
them.

Open <http://localhost:3000>.

In development the dashboard finds `../brightdata-mcp-studio/registry.json` on
disk, so a run you trigger from your agent shows up as soon as it finishes.

### Environment

```bash
# Optional. Which repo to read when the local files are not there — i.e. when
# deployed. Defaults to Dinesh210805/brightdata-mcp-studio.
NEXT_PUBLIC_REPO=your-user/your-fork

# Optional. Sign-in and per-user Bright Data key storage.
# Leave both blank and the site still runs: the landing page and /submission
# work with no account, and sign-in shows a "not configured" notice.
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

If you do want sign-in: create a project at supabase.com, enable Google under
Authentication → Providers, add `<your-domain>/auth/callback` as an authorised
redirect URL, and run [`supabase/schema.sql`](supabase/schema.sql) once in the
SQL editor.

---

## The routes

| Route | Who it is for |
|---|---|
| `/` | Landing page. What the project does. |
| `/submission` | The same dashboard, public, no account. Built for hackathon judging. |
| `/submission/s/[domain]` | One scraper's history, public. |
| `/app` | The signed-in dashboard, with your own key in the config block. |
| `/app/s/[domain]` | One scraper: runs, fields under watch, collected rows, repair log. |
| `/app/repairs` | Every repair across every site, one timeline. |
| `/app/settings` | Connect or replace your Bright Data key. |

`/app*` and `/submission*` render the same components. A judge following a link
should see what a user sees, not a second thing to keep true.

---

## What it does not do yet

- **It is read-only.** There is no button that runs or repairs a scraper.
  Both happen through your coding agent (`scraper_run`, `scraper_heal`) or on
  the schedule. Adding buttons means the dashboard needs to hold a Bright Data
  key server-side and act with it, which is a real decision, not a small one.
- **It shows the latest rows, not the history.** `data/<domain>/` keeps a
  timestamped file per run; only `latest.json` is rendered.
- **Deployed, it is only as fresh as the last commit.** Between cron runs the
  numbers do not move.
