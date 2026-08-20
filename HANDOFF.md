# Handoff — state of the project on 2026-08-20

Context for whoever picks this up next, human or AI.

Read [CLAUDE.md](CLAUDE.md) first for house rules and the API gotchas. This
file is the *current state*: what works, what is broken, what is missing, and
what to do next. [PLAN.md](PLAN.md) is the original build plan and is now
**out of date as a tracker** — all 75 of its checkboxes are still unticked even
though most of the work is done. Trust git history and this file, not PLAN.md.

---

## What this project is, in one paragraph

A fork of Bright Data's MCP server that adds the thing their official server
lacks: the ability to build a scraper for any public website from a plain
English description, notice when that scraper breaks because the site changed,
repair it, verify the repair actually worked, and do all of that unattended on
a schedule. Plus a dashboard to watch it happen and a published npm package so
anyone can install it.

---

## Current state: what works

Everything in this section has been verified, not assumed. Verification
commands are given so you can re-check rather than trust this file.

### 1. Build a scraper from a description — WORKS

One tool call, one sentence, clean structured data back. No site-specific code.

Evidence: `news.ycombinator.com` was built from the prompt
`"top stories: title, points, author"` and returns 60 correctly typed rows
(`points` is a number, not a string).

```bash
node -e "const r=require('./brightdata-mcp-studio/registry.json');console.log(JSON.stringify(r['news.ycombinator.com'].last_sample[0],null,2))"
```

### 2. Self-healing — WORKS, AND HAS ACTUALLY HAPPENED

The loop is: reuse → run → check health → repair → **run again to verify** →
escalate once → stop. The re-run is the part that matters; Bright Data's repair
reports success when the AI job finishes, not when the data is correct.

Evidence: `lobste.rs` has repaired itself twice. Check `heal_history`:

```bash
node -e "const r=require('./brightdata-mcp-studio/registry.json');for(const[k,v]of Object.entries(r))console.log(k,(v.run_history||[]).length+' runs',(v.heal_history||[]).length+' heals')"
```

### 3. Unattended scheduled runs — WORKS (fixed 2026-08-20)

GitHub Actions, every 6 hours, one domain at a time (Bright Data caps parallel
AI jobs). Commits its results back to the repo on every run.

Was broken for days. Root cause: `registry.json` was gitignored, so the CI
checkout had no registry, the cron loaded an empty one, exited in 11 seconds,
and the commit step then failed on a file that did not exist. Fixed in
`47e313c`. First green run: 11m9s, 4 domains, 372 rows, bot commit `579e0b3`.

### 4. Published to npm — LIVE

`brightdata-mcp-studio` on npm. Verified by clean-installing into an empty
directory and speaking real MCP protocol to it — handshake succeeded, 16 tools
listed, all 7 `scraper_*` tools present.

```bash
npm view brightdata-mcp-studio version
```

Note: **1.0.0 is published; the repo is at 1.0.1 and has NOT been published.**
1.0.1 contains the corrected server display name and the new README. Publishing
is a manual step the user must run (`npm publish --access public`).

### 5. Data storage — CODE DONE, NOT YET CONFIRMED ON REAL DATA

Added 2026-08-20 in `6393ec8`. Previously every run collected hundreds of rows
and kept only 3 (the registry's `last_sample`, meant as a UI preview). Now
`scraper/store.js` writes, for every healthy run:

```
brightdata-mcp-studio/data/<domain>/latest.json     overwritten - what consumers read
brightdata-mcp-studio/data/<domain>/<timestamp>.json kept - the history
```

Wired into `ensure()` rather than `cron.js`, so a direct `scraper_ensure` call
persists too — storage is a property of the product, not of our schedule.

**OPEN ITEM:** a CI run (`32364638655`) was dispatched to generate the first
real data and was still running when the session ended. Check it:

```bash
gh run view 32364638655 -R Dinesh210805/brightdata-mcp-studio
ls brightdata-mcp-studio/data
```

If `data/` exists and contains JSON, feature 5 is confirmed. If the run failed,
read the log before assuming the code is wrong — see "Network" below.

---

## The one serious bug: asking a second question destroys a scraper

**Priority: highest. This is the only way the system can lose a user's work.**

### What happens

You have a scraper for `python.org` that collects job listings. You ask for
`python.org` release notes. The system:

1. Looks up by domain, finds the jobs scraper, reuses it
2. Runs it, gets data that does not match the jobs baseline
3. Concludes **its own scraper is broken**
4. Rewrites it with the repair AI
5. That does not help, so it abandons the collector and builds a new one

A normal request destroys a working scraper. Nothing errors; it looks like the
system doing its job.

### Why

`scraper/registry.js` files scrapers by domain only — `registry[domain] = entry`,
one slot per website. And `scraper/health.js` cannot distinguish *"the site
changed"* from *"you asked for something different"*. Both look identical from
inside: the expected fields are not in the returned data. The loop's only
response to a mismatch is to rewrite the scraper.

### Confirmed, not theoretical

Triggered accidentally on 2026-08-20 while testing. It reached the escalation
branch (`ensure.js` ~line 199) and only stopped because a network failure broke
the create call. No damage occurred — the registry never saved (the exception
fired before `deps.save`), and the `python.org` collector was verified afterwards
to still return correct job listings.

### Extra danger

There is **no delete API** at Bright Data. Every escalation orphans a collector
in the account permanently. So this bug also leaks collectors.

---

## Not built yet

| Missing | What it means | Size |
|---|---|---|
| Deliberate scraper editing | No way to say "also collect X" on purpose. The rewrite capability exists (it is what repairs use) but is only ever triggered automatically. | small |
| Multiple scrapers per website | One slot per domain. This is what makes the bug above unavoidable rather than just unhandled. | medium |
| Agent-created schedules | The 6-hour cron is a YAML file a human wrote. The agent cannot set one up. | medium |
| Keyword-only scraping | Every tool requires a URL (`z.string().url()`). Bright Data supports keyword/country input with no URL; we cannot express it. | medium |
| Sitemap crawling | No way to crawl a whole site, so no docs-to-RAG and no competitor-changelog diffing. | large |
| Delivery to user destinations | `build_collector_request` already accepts `deliver_webhook` and it is never exposed. Bright Data natively delivers to S3/GCS/Azure/Snowflake/webhook. | ~15 min |

---

## The dashboard (UI)

Next.js 16 + Supabase, in `dashboard/`. Runs separately from the MCP server.

**What exists:**

- Google sign-in (Supabase auth)
- Bright Data device-flow onboarding, so a user can connect their key without
  copy-pasting it
- Main app view: scraper mosaic, activity feed, health verdict, machine panel
- Per-scraper detail pages (`/app/s/[domain]`)
- A repairs view (`/app/repairs`)
- Settings (`/app/settings`)
- Live CI run history, read from GitHub's public API — **no auth needed**
- A submission view (`/submission`)

**How it gets data:** it reads `registry.json`. Locally from disk; when
deployed, from `raw.githubusercontent.com`. This is why committing the registry
mattered — before that, the deployed dashboard rendered empty.

**Known UI gaps:**

- It reads `registry.json` only. It does **not** yet read the new `data/`
  folder, so the rows a run collected are not shown anywhere.
- `dashboard/README.md` is still stock `create-next-app` boilerplate.
- Hardcoded to the repo `Dinesh210805/brightdata-mcp-studio` in
  `dashboard/src/lib/actions.ts` and `registry.ts`. Fine for a demo, wrong for
  any other user.
- The Supabase schema has only `profiles` and `device_flows`. No table holds
  scraped data — by design, see decisions below.

---

## The plan, in order

### Step 1 — Stop the destruction (highest priority, ~30 min)

Make `ensure()` compare the requested description against the stored one. If
they differ, do **not** heal. Return a clear message instead:

> There is already a scraper for python.org, built for "job listings: job
> title, company, location, job type". You asked for "latest python releases".
> Create a second scraper, or repeat the original description to reuse this one.

Touches `scraper/ensure.js` only. Add tests to
`test/scraper/ensure.test.js`. Note the test stub factory `make_deps` at the top
of that file — every dependency must be stubbed there or tests silently hit the
network and disk (this already happened once with `store`).

This is a guard, not the real fix, but it removes the data-loss path.

### Step 2 — Deliberate editing (~1 hr)

A `scraper_edit` tool: change what an existing scraper collects, on purpose.
The underlying call already exists — `api.start_heal` →
`POST /dca/collectors/{id}/refactor_template`, which takes a freeform `prompt`.
Repair is just this call with an auto-generated prompt.

Be explicit in the tool description that editing **replaces** what the scraper
collects; it does not add a second capability.

### Step 3 — Multiple scrapers per website (~half a day)

The real fix for the bug. The registry needs to hold several entries per
domain, keyed by purpose.

**Be careful.** `registry.json` is the only record anywhere of which collector
belongs to which site — Bright Data has no list-collectors API. Losing or
corrupting it means losing every scraper. So:

- Write a migration that converts the current one-entry-per-domain shape
- Keep reading the old shape (do not break existing installs)
- Test the migration before running it on the real file
- Commit the real `registry.json` before touching it, so git has a copy

### Step 4 — Agent-created schedules (~2 hrs)

A `scraper_schedule` tool that emits a GitHub Actions workflow file so the
agent can write it and open a pull request.

**Do not build OAuth for this.** The MCP server runs on the user's own machine,
inside their coding agent, in their checkout, with their git credentials
already working. It does not need to act on their behalf remotely — it needs to
hand the agent the right file. OAuth would only be needed if the *dashboard*
were the thing creating schedules, which is a different product decision.

The workflow the tool emits should mirror `.github/workflows/scrape.yml`:
`permissions: contents: write`, a concurrency group, `npm ci`, the ensure run,
and a commit-back step that rebases before pushing.

### Step 5 — Smaller wins, any order

- Expose `deliver_webhook` on `scraper_create` (~15 min, already plumbed)
- Make the dashboard read `data/` so collected rows are visible
- Replace `dashboard/README.md`
- Add sample structured output to the main README (submission requirement)
- Cut the upstream PR branch — see below

---

## The upstream PR branch (not started)

`CLAUDE.md` requires a branch `pr/scraper-lifecycle`, **branched from upstream
main, not from our work**, containing only the four stateless tools:
`scraper_create`, `scraper_run`, `scraper_heal`, `scraper_approve`, plus
`Tools.md` entries.

It must **not** contain the registry, `scraper_ensure`, the dashboard, the CI
cron, `CLAUDE.md`, or this file. Branching from our main drags everything in
and the diff becomes unreviewable.

The README already says this PR is coming and links to it as "not yet opened".

---

## Design decisions made this session, and why

Recording these so they are not re-litigated.

**Scraped data goes in the user's own repo, not our database.** Bright Data's
own product model is delivery into customer-owned infrastructure — their
collector API *requires* a `deliver` target, and their destinations are S3,
GCS, Azure, Snowflake, PubSub, SFTP, webhook, email. All customer-owned. They
sell collection, not custody. Putting our Supabase in the middle of a user's
pipeline is precisely the position Bright Data designed their product to avoid.

**The registry is committed to git, not stored in a database.** Two reasons.
Proof: a bot commit every six hours, whose diff shows `heal_history` growing
and `schema_baseline` changing, is publicly verifiable evidence that a machine
repaired something unattended. A private database row is not. And custody: it
keeps the user's data out of our infrastructure. A database is the right answer
for *querying* data later, but that is a different need.

**No GitHub OAuth.** See Step 4 above. The server already runs inside the
user's trust boundary.

**Only healthy runs are stored.** Someone reading `latest.json` should never
have to ask whether the data in it was any good. Broken runs are recorded in
the registry, where the health verdict belongs.

**Health detection uses two checks, not three.** Schema drift and empty-field
ratio (90% threshold). Row-count anomaly detection was deliberately left out:
it needs many runs to mean anything and fires spuriously before then.

---

## Things that will bite you

**The reference CLI is the API spec.** `reference/brightdata-cli/src/commands/scraper.ts`
has every URL, payload shape, status string and retry rule. Read it instead of
guessing. It is gitignored and read-only.

**Create and heal use different field names.** Create takes `description`; heal
takes `prompt` and rejects `description` outright. Already handled in
`scraper/requests.js`, but do not "tidy" it.

**AI jobs cannot run in parallel.** Bright Data returns 429. Runs must be
serialized. The cron does this deliberately.

**There is no delete API.** Every escalation orphans a collector forever. That
is why escalation is capped at one attempt.

**A failed crawl arrives as data, not as an error.** Bright Data returns a
record describing the failure. On a first run those `{error, error_code}` fields
would become the baseline, leaving the scraper "healthy" forever while
returning nothing but errors. `health.js` classifies this as `fatal` and
`ensure()` skips healing on fatal — no rewrite fixes a suspended account.

**Test stubs must be updated when dependencies are added.** `ensure()` injects
`load`/`save`/`run`/`create`/`heal`/`store`. When `store` was added, the tests
kept passing but silently started writing real files to disk. Green tests that
touch the disk are worse than red ones.

**`npm pack --dry-run` before publishing.** `files` in package.json is an
allowlist and silently drops anything omitted. It once dropped LICENSE and
README entirely — an actual MIT violation, invisible to every test, because the
code runs fine without them. They are now generated by a `prepack` script from
the repo root; do not commit copies.

**The user's network was unreliable on 2026-08-20.** Requests to
`api.brightdata.com` swung between 5s, 15s and outright timeouts; `gh` failed
to reach GitHub seconds after `curl` succeeded. Two test runs died because of
it. If something fails locally, check connectivity before debugging code. CI
runs on GitHub's network and was unaffected.

**Credits.** Balance was **$51.95** on 2026-08-20. Every AI build and every run
spends credit. The cron is 4 domains x 4 runs/day. Check before a demo:

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" https://api.brightdata.com/customer/balance
```

---

## Hackathon use cases — honest status

The brief lists nine project ideas. Status:

| # | Idea | Status |
|---|---|---|
| 1 | One-prompt scraper | **Done.** Proven with real output. |
| 2 | Prompt-to-production pipeline | **Done** as of `6393ec8`, pending confirmation that `data/` was written. |
| 3 | Set a goal and walk away | **Partial.** Everything runs unattended, but the agent cannot create the schedule. Step 4. |
| 4 | Self-healing scraper *(hero project)* | **Done and proven.** The strongest card. |
| 5 | Scrapers in CI, no humans | **Done and proven.** Green run, bot commit. |
| 6 | Docs site to RAG | **Not built.** Needs sitemap crawling. |
| 7 | Competitive intel pipeline | **Not built.** Needs sitemap crawling + diffing. |
| 8 | Keyword-powered agent | **Not built.** Blocked by our own URL-required validation, not by Bright Data. |
| 9 | Parallel subagents battle | **Out of scope** per CLAUDE.md. |

Note: the type tags on those ideas (PDP, Discovery, Sitemap, Search) are not
API parameters. Bright Data's build endpoint takes only `{description, urls}`
— there is no scraper-type field. PDP and Discovery are documented input
shapes; Sitemap is a separate Bright Data product; Search is a Discovery
scraper driven by a keyword. The tags are guidance for humans picking a
project, not something to implement.

---

## Still outstanding from this session

1. **Confirm CI run `32364638655`** produced `data/` — it was mid-flight at
   session end
2. **Publish 1.0.1 to npm** — the repo has fixes the published 1.0.0 lacks
   (server display name, README). User must run `npm publish --access public`
3. **Fix the reuse bug** — Step 1 above
4. **Demo video** — not started. A full sixth of the judging score.
5. **Sample structured output** in the README — an explicit submission
   requirement, and `data/` now provides it for free

---

## Quick verification of everything

```bash
# tests
cd brightdata-mcp-studio && npm test          # expect 79 passing

# what the scrapers have done
node -e "const r=require('./registry.json');for(const[k,v]of Object.entries(r))console.log(k,(v.run_history||[]).length+' runs',(v.heal_history||[]).length+' heals','rows='+v.last_row_count)"

# unattended history
gh run list -R Dinesh210805/brightdata-mcp-studio --limit 10

# the published package
npm view brightdata-mcp-studio version

# collected data
ls -R brightdata-mcp-studio/data
```
