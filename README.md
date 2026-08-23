<div align="center">

<img src="brightdata-mcp-studio/assets/logo.png" alt="Bright Data" width="300">

# Bright Data MCP Studio

**Scrapers that build themselves, notice when they break, and repair themselves — no human in the loop.**

🕸️ Built for [**Into the Scrape-Verse**](https://www.wemakedevs.org/hackathons/scrape-verse) — WeMakeDevs × Bright Data, August 2026

</div>

---

## What this is

Point a coding agent at any public page and describe what you want. It builds
a scraper for it, runs it, and keeps watching:

```
create it  →  run it  →  check the data  →  repair it  →  run it AGAIN to confirm
                                                       →  still broken? rebuild from scratch
```

Two schedules watch every scraper without being asked — a full pass every six
hours, and a cheap health-only check every fifteen minutes — sharing one lock
so they can never step on each other's repairs. When something breaks, you get
an email before you'd have noticed yourself. A dashboard shows the whole
history: every run, every repair, the exact prompt sent to fix it, and whether
the fix actually held.

This is built on Bright Data's official open-source MCP server as a starting
point; the lifecycle, health checks, self-healing loop, dashboard, and alerts
described below are this submission's own work — see [Architecture](#architecture)
for exactly which files are which.

---

## Quick start

**Requirements:** Node 20+, a [Bright Data API key](https://brightdata.com/cp/setting).

Nothing to clone or install. Add this to your MCP client (Claude Code, Claude
Desktop, Cursor) and `npx` fetches the
[published package](https://www.npmjs.com/package/brightdata-mcp-studio) on
first run:

```json
{
  "mcpServers": {
    "brightdata-studio": {
      "command": "npx",
      "args": ["-y", "brightdata-mcp-studio"],
      "env": {
        "API_TOKEN": "your-bright-data-api-key",
        "PRO_MODE": "true"
      }
    }
  }
}
```

To work on the code instead, clone it and point the client at your checkout —
[`.mcp.json.example`](.mcp.json.example) has that variant:

```bash
git clone https://github.com/Dinesh210805/brightdata-mcp-studio.git
cd brightdata-mcp-studio/brightdata-mcp-studio
npm install
```

One environment variable, no login flow. `PRO_MODE` unlocks all 93 tools;
without it you get the core 16, which still includes the whole Scraper Studio
lifecycle.

Two optional paths are worth setting if you installed with `npx`, because both
default to the server's own folder — which lives inside `node_modules` and is
wiped on reinstall:

| Variable | What it holds | Why you care |
|---|---|---|
| `REGISTRY_PATH` | which scraper belongs to which site | no API can rebuild it |
| `DATA_DIR` | the rows every run collected | your dataset |

Then just ask:

> *"Get me the top stories from news.ycombinator.com — title, points, author."*

Want to see what it can do before installing anything? The full tool catalog
is browsable at `/tools` on the dashboard — see [Dashboard](#dashboard) below.

---

## What it does

```
Found an existing scraper - reusing c_mszlsh29flg1gvzp8
Ran it: 60 rows
→ healthy
```

That's the second run. The first one builds the scraper, which takes 5–10
minutes while Bright Data's AI writes it. Every run after is seconds.

Two weeks later, the site redesigns:

```
Found an existing scraper - reusing c_mszlsh29flg1gvzp8
Ran it: 60 rows
Data looks wrong: Schema drift: missing price;
                  Field "price" is empty in 100% of records
Asking Bright Data to repair the scraper
Repaired and verified - data looks right again
```

The request was identical. The agent asked for data and got data. The break
and the repair happened underneath — this isn't hypothetical: it happened for
real, unprompted, on a live `producthunt.com` scraper during this project's
own development, caught by the 15-minute check loop and healed with nobody
watching.

If the repair doesn't take, it escalates once — throws the scraper away and
builds a fresh one on the same description.

---

## Architecture

**Two watch loops, one lock.** A 6-hourly scheduled run (`scrape.yml`) does a
full `scraper_ensure` pass on everything. A tighter loop (`fast-check.yml`)
runs every 15 minutes and calls `scraper_check_now` instead — a plain scrape
and a data check, no AI job — so a break gets caught in minutes rather than
hours, at a fraction of the cost. Both loops, plus any manual
`scraper_check_now` call, share one stale-safe lock on the registry:
escalation deletes the collector it abandons, which is irreversible, so two of
them can never heal the same site at once. One of them finds the site busy and
reports that instead of racing it.

**Email alerts, not just logs.** The moment a break is detected and a repair
starts, an email goes out naming the domain and what looks wrong. A second
kind of alert flags anything that can't be auto-repaired at all — a suspended
account or a blocked target, where no scraper rewrite would help. The
six-hourly full pass also sends one digest per run, not one email per site.
Optional — no email provider configured means it just logs instead of
sending, nothing breaks.

**A registry, not a database.** `registry.json` is the only place the mapping
from site → scraper exists; Bright Data's own API can list your collectors but
not what each one targets. Every run and every repair attempt is appended to
it, and the scheduled workflows commit it back to the repo — so the run
history is a public, verifiable git log, not a private database row nobody
can check.

**Project layout:**

```
brightdata-mcp-studio/
├── server.js, browser_tools.js, ...   ← Bright Data's official server (MIT)
│
├── scraper/          the lifecycle
│   ├── requests.js     API payloads and status vocabulary
│   ├── api.js          REST client, polling, retry, batch fallback
│   ├── registry.js     which scraper belongs to which site, plus the heal lock
│   ├── health.js       breakage detection (schema drift, empty-field ratio)
│   ├── ensure.js       reuse/run/check/repair/verify/escalate, lock-wrapped
│   ├── fast_check.js   the cheap 15-minute health check
│   ├── email.js        break alerts and the scheduled-run digest
│   └── tools.js        the 8 MCP tools
├── account/tools.js  zones, budget, page formats
├── browser/          7 browser actions their server lacks
└── test/scraper/     unit tests for all of the above

dashboard/            Next.js app — a read-only window onto the registry
```

Everything under `scraper/`, `account/`, `browser/`, `test/`, and `dashboard/`
was built for this submission. Bright Data's own files were touched only for
tool registration — see `git diff upstream/main --stat` for the exact lines.

---

## The tools

**93 total: 74 from Bright Data, 19 added here.**

### Scraper Studio lifecycle

| Tool | What it does |
|---|---|
| **`scraper_ensure`** | **The one to use.** Reuse-or-build, run, health-check, repair, verify, escalate — one call |
| `scraper_create` | Build a scraper. Returns a collector ID immediately; generation runs 5–10 min |
| `scraper_status` | Poll build progress |
| `scraper_run` | Run a scraper by collector ID |
| `scraper_heal` | Repair a broken scraper from a description of what's wrong |
| `scraper_approve` | Accept or reject a proposed repair |
| `scraper_registry_list` | Every scraper you own, with health and repair counts |
| `scraper_check_now` | Fast, on-demand health check — a real scrape and a data check, no AI job — that only escalates to a full repair if the data is actually wrong |

### Account and page formats

`zones_list` · `budget_status` · `scrape_screenshot` · `scrape_metadata`
· `include_content` option added to their `discover`

### Browser actions their server lacks

`select` · `check` · `uncheck` · `hover` · `reload` · `cookies` · `close_session`

These run on **their** browser session, not a second one — element references
come from a snapshot of one specific page, so a separate browser would be
handed references that mean nothing.

Full reference: [`brightdata-mcp-studio/assets/Tools.md`](brightdata-mcp-studio/assets/Tools.md),
or browse it live at `/tools` on the dashboard.

---

## How Scraper Studio is used

Every scraper here comes from the custom Scraper Studio AI flow. Nothing falls
back to a pre-built `web_data_*` extractor.

The REST calls, taken directly from Bright Data's own CLI source:

| Step | Call |
|---|---|
| Create the collector | `POST /dca/collector` |
| Start the AI build | `POST /dca/collectors/{id}/automate_template` |
| Watch it build | `GET /dca/collectors/{id}/automate_template/progress` |
| Repair | `POST /dca/collectors/{id}/refactor_template` |
| Answer the approval gate | `POST /dca/collectors/{id}/resume_automation_job` |
| Run | `POST /dca/trigger_immediate` → `/dca/get_result` |
| Run (large pages) | `POST /dca/trigger` → `/dca/dataset` |

Three details that shaped the code:

**Creating is two calls, not one.** The first returns a collector ID in about
a second; the second starts a build that takes 5–10 minutes. That split is why
`scraper_create` can answer immediately instead of holding a tool call open.

**The fast run path refuses large pages.** It answers with an error row rather
than data. That looks like failure but isn't — `scraper_run` detects it and
retries on the batch endpoint automatically.

**Repair doesn't check its own work.** Bright Data reports a repair as
successful when its AI job finishes, not when the data is correct. Verifying
that — and only trusting a repair once a second run proves it — is this
project's own addition.

---

## Known limitations

Stated plainly, because they're real:

- **Building a scraper takes 5–10 minutes.** That's Bright Data's AI, not us.
  Reusing one takes seconds, which is why the registry matters.
- **Escalation deletes the broken collector.** Deletion is irreversible, so
  escalation is capped at one attempt. The rebuild removes the old scraper it
  abandoned, and the registry records what was deleted.
- **The registry is single-account.** `registry.json` maps one account's
  scrapers to their sites. Signing into the dashboard doesn't give you your
  own fleet — it's one shared registry, one cron schedule, one alert inbox.
  Real multi-user support is out of scope for this build.
- **Health detection uses two checks, not three.** Schema drift and
  empty-field ratio. Row-count anomaly detection was deliberately left out: it
  needs a baseline of many runs to mean anything and fires spuriously before
  then.
- **Email alerts need a provider configured.** Without `RESEND_API_KEY` set as
  a repo secret, breaks and digests are logged, not emailed.

---

## Dashboard

`dashboard/` is a Next.js app that shows what the registry knows without an
agent in the loop: which scrapers exist, what's actively monitoring each one
and when it was last checked, the full repair timeline (the exact prompt sent
to Bright Data and whether the follow-up run proved it worked), a live cron
log split by which schedule ran it, and the full MCP tool catalog at `/tools`.
It reads the same `registry.json` the tools write — it's read-only, nothing in
it can do anything the MCP tools can't already do.

Deploy notes (Vercel, env vars, the Supabase redirect gotcha): [`dashboard/DEPLOY.md`](dashboard/DEPLOY.md).

---

## Development

```bash
cd brightdata-mcp-studio
npm test                 # 118 tests: ours plus upstream's
```

The full design and task breakdown is in [`PLAN.md`](PLAN.md); conventions are
in [`CLAUDE.md`](CLAUDE.md).

---

## Upstream contribution

The four stateless tools — `scraper_create`, `scraper_run`, `scraper_heal`,
`scraper_approve` — are being prepared as a pull request to
[`brightdata/brightdata-mcp`](https://github.com/brightdata/brightdata-mcp), so
the gap is closed for everyone rather than just here.

`scraper_ensure`, the registry, the heal lock, and the health checks
deliberately stay out of that PR. They need memory between calls, and Bright
Data's server runs multi-tenant across thousands of API tokens — cross-request
state there is an infrastructure project, not a patch.

*Status: not yet opened. The link will be added here.*

---

## About

Built solo by **Dinesh** for Into the Scrape-Verse (WeMakeDevs × Bright Data),
August 2026.

Portfolio and social links — coming soon.

---

## AI assistance

This project was built with Claude (Anthropic) as a pair programmer. Every
design decision, endpoint, and API behaviour documented here was verified
against Bright Data's live API or their published source before being relied
on — several planned features changed or were dropped as a result, and those
decisions are recorded in the commit history. The author understands and can
explain every part of the codebase.

---

## Licence

Bright Data's original server code is MIT-licensed, © Bright Data — see
[`LICENSE`](LICENSE). Everything in `scraper/`, `account/`, `browser/`,
`test/`, and `dashboard/` is this submission's own work, released under the
same terms. The Bright Data logo is used for attribution only; this project is
independent and not endorsed by Bright Data.
