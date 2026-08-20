<div align="center">

<img src="brightdata-mcp-studio/assets/logo.png" alt="Bright Data" width="300">

# Bright Data MCP Studio

**Give an AI agent the ability to build its own scraper — and repair it when the site changes.**

A fork of [`brightdata/brightdata-mcp`](https://github.com/brightdata/brightdata-mcp)
that adds the Scraper Studio lifecycle their official server is missing.

🕸️ Built for [**Into the Scrape-Verse**](https://www.wemakedevs.org/hackathons/scrape-verse) — WeMakeDevs × Bright Data, August 2026

</div>

---

## The gap this fills

Bright Data's official MCP server gives agents 74 tools: search, scrape, browser
automation, and ~50 ready-made extractors for sites like Amazon and LinkedIn.

Point it at a site that isn't one of those 50 and the agent is stuck.

Bright Data *can* build a scraper for any public page — you describe what you
want in plain English and their AI writes it. That's **Scraper Studio**. But it
is reachable only from a terminal or their web dashboard. An agent in the middle
of a conversation cannot get to it.

**This fork closes that gap, and then closes the loop.** Scrapers rot. A site
changes its layout and yesterday's scraper doesn't error — it quietly returns
rows of blanks, and nothing notices until a human looks. So the tools here
don't stop at "build a scraper":

```
run it  →  check the data  →  repair it  →  run it AGAIN to confirm
                                        →  still broken? rebuild from scratch
```

No human in the loop.

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

One environment
variable, no login flow. `PRO_MODE` unlocks all 92 tools; without it you get the
core 16, which still includes the whole Scraper Studio lifecycle.

Two optional paths are worth setting if you installed with `npx`, because both
default to the server's own folder — which lives inside `node_modules` and is
wiped on reinstall:

| Variable | What it holds | Why you care |
|---|---|---|
| `REGISTRY_PATH` | which scraper belongs to which site | no API can rebuild it |
| `DATA_DIR` | the rows every run collected | your dataset |

Then just ask:

> *"Get me the top stories from news.ycombinator.com — title, points, author."*

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

The request was identical. The agent asked for data and got data. The break and
the repair happened underneath.

If the repair doesn't take, it escalates once — throws the scraper away and
builds a fresh one on the same description.

---

## The tools

**92 total: 74 from Bright Data, 18 added here.**

### Scraper Studio lifecycle — the reason this fork exists

| Tool | What it does |
|---|---|
| **`scraper_ensure`** | **The one to use.** Reuse-or-build, run, health-check, repair, verify, escalate — one call |
| `scraper_create` | Build a scraper. Returns a collector ID immediately; generation runs 5–10 min |
| `scraper_status` | Poll build progress |
| `scraper_run` | Run a scraper by collector ID |
| `scraper_heal` | Repair a broken scraper from a description of what's wrong |
| `scraper_approve` | Accept or reject a proposed repair |
| `scraper_registry_list` | Every scraper you own, with health and repair counts |

### Account and page formats

`zones_list` · `budget_status` · `scrape_screenshot` · `scrape_metadata`
· `include_content` option added to their `discover`

### Browser actions their server lacks

`select` · `check` · `uncheck` · `hover` · `reload` · `cookies` · `close_session`

These run on **their** browser session, not a second one — element references
come from a snapshot of one specific page, so a separate browser would be handed
references that mean nothing.

Full reference: [`brightdata-mcp-studio/assets/Tools.md`](brightdata-mcp-studio/assets/Tools.md)

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

**Creating is two calls, not one.** The first returns a collector ID in about a
second; the second starts a build that takes 5–10 minutes. That split is why
`scraper_create` can answer immediately instead of holding a tool call open.

**The fast run path refuses large pages.** It answers with an error row rather
than data. That looks like failure but isn't — `scraper_run` detects it and
retries on the batch endpoint automatically.

**Repair doesn't check its own work.** Bright Data reports a repair as
successful when its AI job finishes, not when the data is correct. Verifying
that is this project's own addition, and it's the difference between "we
repaired it" and "we know it works."

---

## What's ours, what's Bright Data's

Bright Data's code sits at the top level of
[`brightdata-mcp-studio/`](brightdata-mcp-studio/). Ours is in its own
directories:

```
brightdata-mcp-studio/
├── server.js, browser_tools.js, ...   ← Bright Data (MIT)
│
├── scraper/          ← ours: the lifecycle
│   ├── requests.js     API payloads and status vocabulary
│   ├── api.js          REST client, polling, retry, batch fallback
│   ├── registry.js     which scraper belongs to which site
│   ├── health.js       breakage detection
│   ├── ensure.js       the reuse/run/check/repair/verify/escalate loop
│   └── tools.js        the 7 MCP tools
├── account/tools.js  ← ours: zones, budget, page formats
├── browser/          ← ours: the 7 missing browser actions
└── test/scraper/     ← ours: 57 unit tests
```

We touched **76 lines** across three of their files — imports, tool
registration, and one option added to `discover`. Everything else is additions:

```bash
git diff upstream/main --stat
```

---

## Known limitations

Stated plainly, because they're real:

- **Building a scraper takes 5–10 minutes.** That's Bright Data's AI, not us.
  Reusing one takes seconds, which is why the registry matters.
- **Escalation orphans a collector.** Bright Data exposes no delete API, so a
  rebuilt scraper leaves the old one in your account permanently. Escalation is
  capped at one attempt for exactly this reason, and abandoned IDs are recorded.
- **The registry is single-account.** `registry.json` is a local file. It's also
  the *only* record of which scraper belongs to which site — there's no
  list-collectors API — so losing it means losing track of every scraper.
- **Health detection uses two checks, not three.** Schema drift and empty-field
  ratio. Row-count anomaly detection was deliberately left out: it needs a
  baseline of many runs to mean anything and fires spuriously before then.

---

## Development

```bash
cd brightdata-mcp-studio
npm test                 # 73 tests: 57 ours, the rest upstream's
```

The full design and task breakdown is in [`PLAN.md`](PLAN.md); conventions are
in [`CLAUDE.md`](CLAUDE.md).

---

## Upstream contribution

The four stateless tools — `scraper_create`, `scraper_run`, `scraper_heal`,
`scraper_approve` — are being prepared as a pull request to
[`brightdata/brightdata-mcp`](https://github.com/brightdata/brightdata-mcp), so
the gap is closed for everyone rather than just here.

`scraper_ensure`, the registry and the health checks deliberately stay out of
that PR. They need memory between calls, and Bright Data's server runs
multi-tenant across thousands of API tokens — cross-request state there is an
infrastructure project, not a patch.

*Status: not yet opened. The link will be added here.*

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

Upstream code is MIT, © Bright Data — see
[`LICENSE`](LICENSE). Additions in `scraper/`, `account/`, `browser/` and
`test/` are released under the same terms.

The Bright Data logo is used for attribution. This is an independent fork and
is not endorsed by Bright Data.
