# Project: Scraper Studio MCP + Agent Dashboard (+ upstream PR)

## One-line summary

An MCP server that gives AI agents the ability to autonomously create, run,
and self-heal custom Bright Data Scraper Studio scrapers, wrapped in a web
dashboard with a live conversational agent — plus a genuine upstream PR to
Bright Data's own official MCP server adding the same lifecycle tools there.

Built for the "Into the Scrape-Verse" hackathon (WeMakeDevs x Bright Data,
Aug 17-23, 2026). Entered in the Web-Slinger (grand prize), Suit-Up (Best
UI), and Spider-Sense (Best Clean Code) tracks.

---

## The problem this solves

Bright Data ships an official MCP server (`@brightdata/mcp`, open source,
MIT, ~2.6k GitHub stars, 69 tools) giving AI agents search, scrape,
discover, browser automation, and 45+ pre-built platform extractors.

**It has no tool for creating a brand-new custom scraper for a site nothing
pre-built covers, and no tool for self-healing one when the site changes.**
Verified directly against their full `Tools.md` tool reference — no
`scraper_create`, `scraper_heal`, or Collector ID lifecycle exists anywhere
in the 69 tools. That capability exists only via the separate `bdata` CLI
(`scraper create/run/heal/approve`), the Scraper Studio dashboard, or the
IDE — never as something an autonomous agent can call for itself, and never
inside the tool most agents already have installed.

This project fills that gap two ways: a standalone companion MCP server
(the actual submission), and a genuine pull request adding the same
stateless lifecycle tools to their official repo (a bonus, not the
submission itself — see Component 5).

---

## Competitive landscape (read before building)

**A near-identical project already exists for this same hackathon:**
`scraper-health-mcp` by a solo builder (GitHub: `0xConsole/scraper-health-mcp`,
live demo at `scraper-health-mcp.vercel.app`, Apache 2.0). It independently
found the same technical unlock we did (`POST /dca/collectors/{id}/resume_automation_job`
for hands-off heal approval) and ships 5 MCP tools: `create_scraper`,
`run_collector`, `health_check`, `self_heal`, `verify`.

Honest comparison:

| | Theirs | Ours |
|---|---|---|
| Reuse logic | Manual collector registration | **Automatic** domain registry, decides reuse-vs-create itself |
| Interface | Fixed dashboard, "Run Full Demo" button, "simulate breakage" trigger | **Conversational chat agent** — natural language in, live tool-use trace |
| Unattended proof | Vercel-hosted, human-triggered on demand | **GitHub Actions cron** — real, public, timestamped unattended history |
| Breakage detection | Schema validation + null-field + statistical row-count anomaly (mean/std baseline) | Currently a blunt "all fields null" check — **needs upgrading to match or beat theirs, this is a real gap, not just a difference** |
| Failure fallback | "Escalate: regenerate scraper from scratch" if heal fails repeatedly | **Not yet built — adopt this** |
| Approve/reject granularity | Bundled into one `self_heal` call | Separate `scraper_heal` / `scraper_approve`, matching the CLI's real approval gate |

Two concrete, mandatory upgrades to `lib/bdata.js` before this project is
competitively solid (see Component 1 below):
1. Replace the null-check with real schema validation + null-field detection
   + row-count anomaly detection against a rolling baseline
2. Add an escalate-and-regenerate fallback: if `scraper_heal` fails or the
   re-run still looks broken after one heal attempt, call `scraper_create`
   fresh on the same URL/description instead of giving up

Do not treat the overlap with this competing project as disqualifying — the
hackathon's own materials point everyone at self-healing as the headline
feature, so convergence is expected. The differentiation is in the
conversational interface, the unattended CI proof, and closing the
detection-quality gap above — not in claiming the underlying discovery is
unique, because it verifiably isn't anymore.

---

## Bright Data CLI vs official MCP — why the architecture is split the way it is

Both surfaces expose largely the same underlying Bright Data APIs. Verified
directly from both repos' current docs:

| Capability | CLI (`bdata`) | Official MCP (`@brightdata/mcp`) |
|---|---|---|
| Custom scraper create/run/heal/approve | ✅ Full Scraper Studio lifecycle | ❌ Nothing — **the gap this project fills** |
| Search / scrape / discover | ✅ | ✅ (plus batching) |
| Pre-built platform data | ✅ 41 `pipelines` types | ✅ 45 `web_data_*` tools (superset: npm/PyPI/GEO) |
| Browser automation | ✅ 20 subcommands, most complete | ✅ 13 tools, functional subset |
| Account admin (`zones`, `budget`) | ✅ | ❌ |
| Runs mid-conversation, no shell | ❌ (needs shell access) | ✅ Native tool call |

This is why `lib/bdata.js` (our own server) shells out to the `bdata` CLI —
it already solved auth, polling, retries, and envelope parsing, and none of
that logic needs to be reinvented. The official MCP is architecturally
Node/TypeScript hitting Bright Data's REST endpoints directly (no CLI
dependency, since it must work for any of their multi-tenant hosted users)
— which is why Component 5's fork does NOT shell out to `bdata`, and instead
calls the REST endpoints directly, matching their existing code's pattern.

Known REST endpoints (verified from CLI docs + heal/approve behavior docs):
- Run (single, async): `POST /dca/trigger_immediate` → poll `GET /dca/get_result`
- Run (single, sync): `POST /dca/crawl` (25-50s server cap)
- Run (batch, 2+ URLs): `POST /dca/trigger` → poll `GET /dca/dataset`
- Heal: `POST /dca/collectors/{id}/refactor_template`
- Approve/reject: `POST /dca/collectors/{id}/resume_automation_job`
- Create: endpoint not yet confirmed in what we've verified — **before
  writing Component 5's `scraper_create` tool, inspect the `bdata` CLI's own
  TypeScript source (`brightdata/cli`, `src/`) for the exact AI-Flow
  create endpoint, or consult `docs.brightdata.com/api-reference/scraper-studio-api`.
  Do not guess this one.**

---

## Hard constraints (hackathon rules — do not violate)

- Every scraper this project creates MUST go through Bright Data Scraper
  Studio's custom-scraper flow. Never fall back to a pre-built Scrapers
  Library entry as the primary data source.
- Only scrape publicly available web data. No login-gated, paywalled, or
  personal data.
- Any AI coding assistance used to build this must be disclosed in the
  README.
- The person building this must understand every part of the code well
  enough to explain it.
- Submission needs: public repo, clear README, sample structured output,
  demo video, explicit explanation of how Scraper Studio is used.

---

## Architecture overview

```
  OUR SUBMISSION (the actual deliverable)
  ==========================================

                        +-------------------------+
                        |   registry.json           |
                        |   domain -> {              |
                        |     collector_id,          |
                        |     created_at,            |
                        |     last_sample,           |
                        |     heal_history: [...]    |
                        |   }                         |
                        +------------+--------------+
                                     |
                      +--------------+---------------+
                      |      lib/bdata.js               |
                      |  create/run/heal/approve/ensure  |
                      |  + health-check (schema/null/    |
                      |    anomaly) + escalate-regenerate |
                      |  wraps the `bdata` CLI            |
                      +---+-----------------------+-----+
                          |                         |
          +---------------+                         +----------------+
          |                                                          |
  +-------v---------+                                    +-----------v----------+
  |  mcp/server.js     |                                    |  web/server.js (API)   |
  |  MCP server, stdio  |                                    |  Express + Claude API   |
  |  Consumed by Claude |                                    |  tool-use loop for the   |
  |  Desktop/Code,      |                                    |  chat agent               |
  |  Cursor              |                                    +-----------+-----------+
  +----------------------+                                                |
                                                                +----------v-----------+
   .github/workflows/scrape.yml                                |  web/frontend/          |
   Cron. Calls lib/bdata's ensure()                             |  Chat agent, registry     |
   on a schedule. Auto-heals.                                    |  table, heal log, CI      |
   "Wall of green checks" proof.                                  |  badge, sample output     |
                                                                    viewer
                                                                    +------------------------+


  BONUS TRACK (upstream contribution, not required for submission)
  ==================================================================

  fork of brightdata/brightdata-mcp
          |
          v
  Add scraper_create / scraper_run / scraper_heal / scraper_approve
  as NEW stateless MCP tools, matching their existing code style,
  calling the REST endpoints directly (no bdata CLI dependency,
  no registry/state - see "What does NOT go in the fork" below)
          |
          v
  Open a real PR against brightdata/brightdata-mcp.
  Reference the PR URL in our own README regardless of merge status.
```

Key principle: **the scraper logic (`lib/bdata.js`) is written once** and
consumed by three surfaces (MCP server, dashboard backend, CI cron). The
fork/PR track is separate and does not depend on `lib/bdata.js` at all,
since it can't assume the target machine has the `bdata` CLI installed.

---

## Component 1: `lib/bdata.js` (shared core — build this first)

Wraps the `bdata` CLI (must be installed + authenticated on the host machine
via `npm install -g @brightdata/cli && bdata login`) and manages the
registry.

Exports:

- `create(url, description, name?)` -> `{ collector_id, name }`
- `run(collectorId, url)` -> parsed JSON
- `heal(collectorId, prompt, { autoApprove, url })` -> handles
  `awaiting_approval`, captures `preview_result` and `diff_summary` from the
  response (not just success/fail)
- `approve(collectorId, { reject, url })`
- `checkHealth(data, domain)` -> **NEW, replaces the old null-check.**
  Runs three checks: (1) schema validation against the last-known-good
  schema for that domain, (2) null/empty-field ratio across records, (3)
  row-count anomaly vs. a rolling mean/std baseline stored per domain in the
  registry. Returns `{ healthy: boolean, reasons: string[] }`.
- `ensure(url, description, { autoHeal = true })` -> the main entry point:
  registry lookup -> reuse or create -> run -> `checkHealth()` -> if
  unhealthy, heal + retry once -> **if still unhealthy after the heal
  attempt, escalate: call `create()` fresh on the same url/description
  instead of giving up**, log the escalation in `heal_history`. Every
  heal/escalation attempt appends a full entry to that domain's
  `heal_history` array (not just a timestamp): `{ timestamp, prompt,
  status, auto_triggered, preview_result?, diff_summary?, escalated? }`
- `listRegistry()`
- `getSample(domain)`

Registry schema (`registry.json`):

```json
{
  "example.com": {
    "collector_id": "c_xxxxx",
    "name": "cli-scraper-...",
    "source_url": "https://example.com/...",
    "description": "product name, price, availability",
    "created_at": "2026-08-19T10:00:00Z",
    "schema_baseline": { "...": "field names + types from first successful run" },
    "row_count_baseline": { "mean": 30, "std": 4 },
    "last_sample": { "...": "last successful JSON output" },
    "heal_history": [
      {
        "timestamp": "2026-08-20T03:00:00Z",
        "prompt": "price field empty, selector likely moved",
        "status": "resolved",
        "auto_triggered": true,
        "preview_result": ["..."],
        "diff_summary": "proposed template has 1 step(s)",
        "escalated": false
      }
    ]
  }
}
```

---

## Component 2: `mcp/server.js` — MCP server (already scaffolded and tested)

Thin wrapper around `lib/bdata.js` using `@modelcontextprotocol/sdk`
(`McpServer`, `registerTool`, `StdioServerTransport`). Tools: `scraper_create`,
`scraper_run`, `scraper_heal`, `scraper_approve`, `scraper_ensure`,
`scraper_registry_list`. Verified working: installs clean, starts clean on
stdio transport. Update the `scraper_ensure` tool's description/behavior
once `checkHealth()` and the escalation path land in `lib/bdata.js`.

---

## Component 3: `web/` — Dashboard + backend agent

### Backend (`web/server.js`, Express)

- `GET /api/registry`, `GET /api/sample/:domain`
- `POST /api/chat` — the headline feature. Anthropic Messages API with
  `scraper_ensure`, `scraper_heal`, `scraper_registry_list` as tools (import
  the same schemas used in `mcp/server.js`, do not redefine twice). Standard
  tool-use loop, streamed to the client so the UI shows live progress:
  "checking registry... creating scraper... running... healing..."
- `POST /api/scraper/heal` — manual force-heal for live demos

### Frontend (`web/frontend/`), priority order

1. **Agent chat panel** — the interactive version of the demo video
2. **Registry table** — domain, Collector ID, dates, health badge, click to
   expand sample JSON
3. **Heal event log** — reverse-chronological across all domains, pulled
   from each `heal_history` array, showing `diff_summary`/`preview_result`
   where available, and flagging escalated entries distinctly
4. **CI status badge** — embedded shields.io badge, no custom polling
5. **Stats strip** — total scrapers, total heals, oldest unattended scraper

Explicitly not in scope: auth, multi-user, a pipeline contribution/review
system.

---

## Component 4: `.github/workflows/scrape.yml` — CI automation

Scheduled cron: checkout -> install `@brightdata/cli` + authenticate via a
`BRIGHTDATA_API_KEY` secret -> run a script calling `lib/bdata.js`'s
`ensure()` -> commit updated `registry.json` or post a Discord/Slack diff
-> only fail loudly if `ensure()` cannot recover even after escalation. A
successful heal-and-recover (or escalate-and-recover) should NOT fail the
job — that's the point being demonstrated.

---

## Component 5: fork + PR to `brightdata/brightdata-mcp` (bonus, not required for submission)

**Goal:** add the missing stateless lifecycle tools to the official MCP
itself, so the fix benefits every user of their server, not just this
project. This does not need to be merged or even reviewed by submission
day to be worth doing — an open, genuine, well-written PR is referenceable
in our README regardless of its status.

**What goes in the fork:**
- `scraper_create`, `scraper_run`, `scraper_heal`, `scraper_approve` — new
  tools matching their existing `web_data_*` / `search_engine` style
  exactly: same file conventions, same input/output shape, same tone in
  tool descriptions
- The improved health-check logic (schema/null/anomaly detection) as either
  part of `scraper_heal`'s response or a new stateless `scraper_health_check`
  tool

**What does NOT go in the fork, and why:**
- `scraper_ensure` (the domain registry + auto-reuse logic) — their MCP is
  hosted multi-tenant at `mcp.brightdata.com` for thousands of different
  API tokens; a cross-request registry would require real per-account
  server-side persistent storage, which is a genuine infrastructure project,
  not a PR-sized addition. Their existing tools are all deliberately
  stateless for this exact reason — match that pattern, don't break it.
- The dashboard, the chat agent, the CI cron — these are application-layer,
  not tool-server-layer. A PR adding a web dashboard to an MCP *server*
  repository would read as scope confusion to a reviewer.

**Process:**
1. Fork `brightdata/brightdata-mcp`
2. Read their existing tool implementations first (e.g. how a `web_data_*`
   tool is structured in their `server.js` / tool files) to match style
   exactly before writing anything new
3. Implement the four tools hitting the REST endpoints directly (see the
   endpoint list above; confirm the `create` endpoint from their CLI source
   before writing that one)
4. Add entries to their `Tools.md` and README following existing formatting
   exactly
5. Write a real PR description: name the gap precisely, explain the fix,
   link to this project's own working server as evidence the approach
   functions in practice
6. Open the PR. Copy the URL into this project's own README's "Upstream
   contribution" section, noting merge status honestly (e.g. "open,
   pending review as of Aug 23").

This must be genuinely clean, not rushed filler — a sloppy PR against a
company's own repo (plausibly reviewed by hackathon judges from that same
company) undermines the story rather than helping it. Treat this as
lower-priority than Components 1-4; only start it once those are solid.

---

## Explicitly out of scope (do not build)

- A generic keyword/search agent — Bright Data's official MCP already has
  `search_engine` and `discover` for this
- A pipeline contribution/marketplace system — real product territory, not
  a hackathon-week feature
- Parallel-subagent "battle" orchestration — a demo video moment at most,
  not real infrastructure

---

## Demo script

1. Dashboard's agent chat, empty state
2. Natural-language request for a site with no existing coverage. Live
   trace: registry miss -> `scraper_create` -> Collector ID -> `scraper_run`
   -> structured data appears
3. Registry table now has a new row
4. Force a break (pre-seeded target mutation, or a real site change if
   timing allows)
5. Request against the broken domain — watch the agent's health check catch
   it, auto-heal, and if needed escalate to regeneration, all with no human
   intervention, visible in the chat trace
6. GitHub Actions tab: green checkmarks, scheduled runs
7. Heal event log showing full history, including the escalation path if
   triggered
8. (If ready) briefly show the open upstream PR against
   `brightdata/brightdata-mcp` as a closing beat

Target length: under 3 minutes.

---

## Tech stack

- Node.js throughout for our own project (matches `@brightdata/cli`'s
  ecosystem)
- `@modelcontextprotocol/sdk` + `zod` for the MCP server
- Express for the dashboard backend
- Anthropic Messages API (`@anthropic-ai/sdk`) with tool use for the
  dashboard's chat agent
- Plain HTML/CSS/JS or a lightweight framework for the frontend — clean,
  not architecturally impressive
- GitHub Actions for the CI cron
- Component 5's fork uses **their** existing stack (Node/TypeScript,
  direct REST calls) — do not introduce the `bdata` CLI dependency there

---

## AI tool disclosure (for the README)

This project's scaffolding, architecture decisions, and initial
implementation were developed with assistance from Claude (Anthropic). All
code has been reviewed and is understood by the project author, who can
explain every component's design and logic.
