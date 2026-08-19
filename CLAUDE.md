# CLAUDE.md

Project guidance for Claude Code. Read this before touching anything.

---

## What this is

A fork of [`brightdata/brightdata-mcp`](https://github.com/brightdata/brightdata-mcp)
that adds the **Scraper Studio custom-scraper lifecycle** their official MCP
server is missing — create, run, detect breakage, self-heal, verify, escalate —
plus the remaining CLI-only features, a web dashboard, and an unattended CI cron.

Built for the "Into the Scrape-Verse" hackathon (WeMakeDevs x Bright Data).

Full design and task breakdown: [PLAN.md](PLAN.md). Original brief:
[PROJECT_SPEC.md](PROJECT_SPEC.md).

---

## Repository layout

The fork **is** the root. Their files sit at the top level; ours sit beside them.

```
d:\Projects\BrightData\
├── CLAUDE.md              ← this file (ours)
├── PLAN.md                ← ours
├── PROJECT_SPEC.md        ← ours
├── reference/             ← READ-ONLY clones, gitignored (see below)
│   ├── brightdata-mcp/    ← pristine upstream, for diffing
│   └── brightdata-cli/    ← the CLI source; our endpoint spec
│
├── server.js              ← THEIRS (edit surgically)
├── browser_tools.js       ← THEIRS (edit: add missing verbs)
├── browser_session.js     ← THEIRS (do not edit)
├── tool_groups.js         ← THEIRS (edit: register new tools)
├── package.json           ← THEIRS (edit: add deps)
├── assets/Tools.md        ← THEIRS (edit: document new tools)
│
├── scraper/               ← OURS
│   ├── api.js             ← REST calls to /dca/* + polling
│   ├── tools.js           ← the 7 lifecycle MCP tools
│   ├── registry.js        ← registry.json persistence
│   └── health.js          ← breakage detection
├── account/               ← OURS
│   └── tools.js           ← zones, budget, scrape variants, discover+content
├── web/                   ← OURS: dashboard (Express + frontend)
└── .github/workflows/     ← OURS: the cron
```

### `reference/` is read-only

Never edit it, never import from it, never ship it. It is gitignored. It exists
for two reasons:

1. `reference/brightdata-mcp/` — pristine upstream. Diff against it to see
   exactly what we changed.
2. `reference/brightdata-cli/` — the CLI's TypeScript source. **This is our
   endpoint specification.** `src/commands/scraper.ts` contains every URL,
   payload shape, status string, and retry rule we need. When unsure how an API
   behaves, read that file rather than guessing.

We do **not** depend on the `bdata` CLI at runtime. We call the REST endpoints
directly, like the rest of their server does.

---

## Code health (non-negotiable)

The codebase must be easy to read and easy to follow. A reader should
understand any file in one pass.

**Do:**

- Keep files small and single-purpose. 200-300 lines is normal, 400 is a smell.
- Write the obvious solution. Straight-line code beats clever code.
- Name things so comments aren't needed. When a comment is needed, explain
  *why*, never *what*.
- Handle errors where they happen, with a message a user could act on.
- Put new code in new files. Touch their files as little as possible.

**Don't:**

- Add abstraction for one caller. No factories, no strategy patterns, no base
  classes with a single subclass.
- Add a dependency for something twenty lines of plain JS can do.
- Nest more than three levels. Use early returns.
- Leave dead code, commented-out blocks, or debug logging.
- Refactor their code because you would have written it differently.

If a function needs a paragraph to explain, it is the wrong shape. Split it.

---

## House style (match theirs exactly)

Their code, our code, same rules. A reviewer should not be able to tell where
the seam is.

- **4-space** indentation
- **`snake_case`** for variables and functions; tool names too
- String wrapping with a leading `+`:

```js
description: 'Create a new AI-generated scraper for any public page. '
    +'Returns a collector_id immediately; generation takes 5-10 minutes.',
```

- **`zod` v3** — they pin `^3.24.2`. Do not use v4 syntax.
- **`fastmcp`** `addTool({name, description, annotations, parameters, execute})`
  — not the raw MCP SDK
- ESM (`import`, not `require`) — `package.json` has `"type": "module"`
- `axios` for HTTP; it is already a dependency

Read the `search_engine` tool at [server.js:201](server.js#L201) before writing
your first tool. Copy its shape.

---

## Things that will bite you

**`tool_groups.js` gates tool loading.** A tool not listed there silently fails
to appear in grouped configs. No error, no warning. Register every new tool.

**AI jobs cannot run in parallel.** Bright Data caps concurrent AI-Flow jobs and
returns 429 (`"cannot run more than N jobs in parallel"`). Create and heal must
be serialized. Their CLI retries 4 times with 30s to 240s exponential backoff;
port that behavior.

**Create is two calls, not one.**

```
POST /dca/collector                                    -> collector_id (instant)
POST /dca/collectors/{id}/automate_template            -> starts 5-10 min build
GET  /dca/collectors/{id}/automate_template/progress   -> poll
```

The instant ID from call one is why `scraper_create` can return without
blocking for ten minutes.

**There is no delete API.** Bright Data does not expose programmatic collector
deletion. Every escalation orphans a collector permanently. Cap escalation at
one attempt and record abandoned IDs in the registry.

**Heal does not verify itself.** It reports success when the AI job finishes,
not when the data is correct. Always re-run and re-check after healing.

**There is no list-collectors API.** `registry.json` is the only place the
domain to collector mapping exists anywhere. Losing it means losing every
scraper.

---

## Endpoints

All authenticated with `Authorization: Bearer ${API_TOKEN}`, base
`https://api.brightdata.com`.

| Purpose | Method | Path |
|---|---|---|
| Create template | POST | `/dca/collector` |
| Start AI build | POST | `/dca/collectors/{id}/automate_template` |
| Build progress | GET | `/dca/collectors/{id}/automate_template/progress` |
| Heal | POST | `/dca/collectors/{id}/refactor_template` |
| Heal progress | GET | `/dca/collectors/{id}/refactor_template/progress` |
| Approve / reject | POST | `/dca/collectors/{id}/resume_automation_job` |
| Run (async) | POST | `/dca/trigger_immediate`, poll `/dca/get_result` |
| Run (sync, 1 URL) | POST | `/dca/crawl` |
| Run (batch) | POST | `/dca/trigger`, poll `/dca/dataset` |

Statuses: `done` = success · `pending_answer` = **awaiting approval** ·
`failed` / `error` / `cancelled` = terminal failure.

Approve payload: `{message: true, auto_save: true}`.
Reject payload: `{message: false}` — `auto_save` is ignored on reject, so omit it.

None of these endpoints use zones.

---

## Auth

Single env var, no login flow:

```
API_TOKEN=<bright data api key>
```

The server throws at startup without it ([server.js:71](server.js#L71)). The
same token works for the MCP client config, the dashboard `.env`, and the GitHub
Actions secret. If you ran `bdata login`, your key is at
`%APPDATA%\brightdata-cli\credentials.json`.

Never commit it. Never log it. Never include it in a tool response.

---

## Branches

```
main                  everything: 85 tools, registry, dashboard, CI. THE SUBMISSION.
pr/scraper-lifecycle  branched from UPSTREAM main. Four stateless tools only.
```

The PR branch must **not** contain the registry, `scraper_ensure`, the
dashboard, the CI cron, or this file. It is `scraper_create` / `scraper_run` /
`scraper_heal` / `scraper_approve` plus `Tools.md` entries — small enough for a
human to review. Branch it from upstream, not from our work, or the diff drags
everything in and dies on arrival.

---

## Commits

`<type>: <description>` — types: `feat`, `fix`, `refactor`, `docs`, `test`,
`chore`. Commit at each working checkpoint, not once at the end of a session.

---

## Licensing and attribution

Upstream is MIT. Keep their `LICENSE` and `CHANGELOG.md` untouched. The README
must state plainly which files are theirs and which are ours — a judge should be
able to tell in ten seconds. Disclose AI assistance in the README, as the
hackathon rules require.

---

## Scope

**In:** scraper lifecycle, registry, health detection, self-heal with verify and
escalate, CLI-parity gaps (zones, budget, screenshot/metadata/async scrape,
discover with content, browser verbs), dashboard, CI cron, upstream PR.

**Out:** auth, multi-user, a scraper marketplace, parallel-agent orchestration,
and anything requiring login-gated or paywalled data. Only public web data —
that is a hard hackathon rule, not a preference.
