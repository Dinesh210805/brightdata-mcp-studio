# Deploying to Vercel

The dashboard is a normal Next.js app with no server-side secrets — it reads
`registry.json` from GitHub and (optionally) lets people sign in with Google
via Supabase. Nothing here needs a database connection string, a cron job, or
a serverless function with real permissions.

This repo holds two separate projects at its root (`brightdata-mcp-studio/`
and `dashboard/`). Vercel needs to be told which one to build.

---

## 1. Import the project

1. [vercel.com/new](https://vercel.com/new) → import
   `Dinesh210805/brightdata-mcp-studio` (or your fork)
2. **Root Directory: set it to `dashboard`.** This is the one setting that
   isn't optional — without it Vercel tries to build the repo root and finds
   no Next.js app there.
3. Framework preset should auto-detect as Next.js. Leave build/output
   settings on their defaults.

## 2. Environment variables

Everything the dashboard reads is `NEXT_PUBLIC_*` — none of it is a secret in
the usual sense, but it still has to be set per-environment in Vercel's
project settings (Settings → Environment Variables), not just in a local
`.env`.

| Variable | Required? | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Only if you want sign-in | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Only if you want sign-in | Same page, the `anon` `public` key |
| `NEXT_PUBLIC_REPO` | No | Defaults to `Dinesh210805/brightdata-mcp-studio`; set only if you forked the scraper under a different owner/name |

Leave both Supabase variables blank and the site still works — the landing
page and `/submission` render with no account system at all; `/app` shows a
"sign-in not configured" notice instead of crashing.

**These values do not change when you change hosting provider.** They are the
Supabase project's own URL and key, the same on localhost, Vercel, or
anywhere else.

## 3. The one thing that *does* need updating: Supabase's redirect allow-list

This is the step people miss, and the failure mode is confusing: sign-in
appears to work, Google's consent screen shows up, and then it bounces back to
`/login?error=exchange_failed`.

Supabase checks every `redirectTo` against an allow-list before it issues a
session code — it doesn't matter that Google already authenticated the user.

In the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: your production URL, e.g. `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/auth/callback`

Do this for every domain that should be able to sign in — including Vercel's
own preview-deployment URLs if you want sign-in to work on preview builds too
(those get a new random subdomain per deploy, so either add a wildcard pattern
if Supabase's UI supports one for your plan, or accept that sign-in only works
on the production domain).

If you haven't set up Supabase at all yet: create a project, enable **Google**
under Authentication → Providers, and run
[`supabase/schema.sql`](supabase/schema.sql) once in the SQL editor before any
of this matters.

## 4. Deploy

Push to `main` (or click Deploy in the Vercel UI). First build takes the usual
minute or two for a Next.js app; nothing here is unusually slow.

## 5. Verify

- `/` and `/tools` should render with no environment variables at all — if
  either 500s, something other than auth is misconfigured.
- `/submission` should show live registry data — if it's empty, check that
  `brightdata-mcp-studio/registry.json` actually has entries committed on
  `main` (the dashboard reads the *committed* file, not a local one, once
  deployed).
- `/login` → sign in — if this fails at the Google screen, the Supabase env
  vars are wrong or missing; if it fails *after* Google (bounces back with
  `error=exchange_failed`), it's step 3, the redirect allow-list.

## What this deploy does **not** do

Deploying the dashboard does not start, schedule, or affect the scraper fleet
in any way. The 6-hourly cron (`scrape.yml`) and the 15-minute fast-check
(`fast-check.yml`) run entirely inside GitHub Actions, on the
`brightdata-mcp-studio` side of the repo, independent of where or whether the
dashboard is deployed. Vercel just serves a read-only window onto whatever
those workflows have already committed.
