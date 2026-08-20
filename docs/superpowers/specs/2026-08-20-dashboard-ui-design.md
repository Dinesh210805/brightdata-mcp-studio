# Dashboard UI — design spec

**Date:** 2026-08-20 · **Deadline:** hackathon closes 2026-08-23
**Supersedes:** the four-route dashboard shipped in `7f9bf78`

---

## What this replaces and why

The current dashboard is four routes: a landing page, a login, a setup wizard
misnamed `/dashboard`, and a static judging page. Three problems, in order of
severity:

1. **`/dashboard` has no data in it.** It renders a dashed box reading "your
   scrapers will appear here". A judge who signs in finds a form.
2. **There is one registry for the entire deployment.** `src/lib/registry.ts`
   reads a single `registry.json` — local file in dev, `raw.githubusercontent.com`
   in production. There is no per-user scraper data anywhere, which is *why*
   problem 1 exists. It is an architecture problem wearing a UI problem's face.
3. **Every section is the same rectangle.** `rounded-card border-line
   bg-surface shadow-card`, eight times. No hierarchy, no focal point, no
   motion, and not one graph — in a product whose entire story is a state
   change over time.

---

## Decisions taken

| Decision | Choice |
|---|---|
| Dashboard capability | Mirror of agent state, **plus** trigger buttons. The agent stays canonical — every feature is reachable from MCP first |
| Tenancy | Real multi-tenant. Google sign-in, per-user Bright Data key, per-user scrapers |
| Per-user data transport | MCP server pushes to us via `STUDIO_TOKEN` (approved) |
| Theme | Light, warm off-white. **No dark mode** |
| Visual direction | Spider-Verse as structural grammar, not costume |

---

## Blocker 0 — seed real data before any UI work

`registry.json` currently holds one domain (`news.ycombinator.com`) with
`"heal_history": []`. `to_stats()` therefore reports `heals: 0` and the repair
log renders "Nothing has broken yet." Criterion 5 — *Reliability and
self-healing* — is scored against an empty page.

**This is wall-clock bound and must start before UI work.** Scraper builds take
5–10 minutes each and Bright Data does not allow parallel AI jobs, so the
builds are serial.

**Target:** 4–5 active domains, at least 2 genuine `heal_history` entries.

**How to induce a break honestly.** `check_health(records, baseline)` in
`scraper/health.js` compares a run's fields against `schema_baseline` stored in
the registry. Adding a field to a baseline that the site does not produce
triggers the real path:

```
schema drift detected  →  reason string names the field
                       →  reason becomes the heal prompt
                       →  Bright Data repair job runs
                       →  verification run re-checks
                       →  heal_history entry written
```

Nothing is mocked. The only authored value is the expectation. The UI must say
so, on the repair entry itself:

> We induced this break by telling the watcher to expect a field the site does
> not return. Everything after that — detection, the repair prompt, the fix,
> and the verification run — happened without a human.

An honest induced break is more convincing than a suspiciously clean log.

**Site selection.** Public data only, and *not* sites covered by Bright Data's
prebuilt library — that is a hard hackathon rule. Candidates from the long
tail: Hacker News (have it), a small municipal open-data listing, an
independent e-commerce store, a conference schedule page, a public job board
that is not Indeed/LinkedIn.

---

## Blocker 1 — per-user data transport

`scraper/registry.js` resolves the registry as
`process.env.REGISTRY_PATH || <beside the server file>`. The MCP server runs on
**the user's machine** via `npx`. Their scrapers live in a JSON file on their
laptop. A hosted dashboard cannot read it.

The MCP server is the writer, the dashboard is the reader, and they share no
filesystem. Someone must push.

**Approved approach — push, riding an existing paste.** The onboarding flow
already generates the `.mcp.json` block for the user to copy. A second env var
costs them zero additional steps:

```json
{
  "mcpServers": {
    "brightdata-studio": {
      "command": "npx",
      "args": ["-y", "brightdata-mcp-studio"],
      "env": {
        "API_TOKEN": "<their bright data key>",
        "STUDIO_TOKEN": "<we generate and store this>"
      }
    }
  }
}
```

**Contract:**

- After every registry save, `scraper/registry.js` fires
  `POST {STUDIO_URL}/api/sync` with `Authorization: Bearer ${STUDIO_TOKEN}` and
  the full registry as the body.
- **Fire-and-forget.** Failures are swallowed. The local file remains the
  source of truth, so a dashboard outage can never break a scrape.
- No-op when `STUDIO_TOKEN` is unset — which is the case for the upstream PR
  branch and for anyone using the server standalone.
- `STUDIO_URL` defaults to the deployed dashboard, overridable for local dev.

**Scope guard.** CLAUDE.md requires the upstream PR branch to contain neither
the registry nor the dashboard. That constraint governs `pr/scraper-lifecycle`
only. The sync lives on `main`, behind the unset-token no-op, so the PR branch
is unaffected.

**Server side:** one Supabase table, one API route, RLS keyed on the token's
owner.

```sql
create table public.registries (
    user_id    uuid primary key references auth.users on delete cascade,
    registry   jsonb not null default '{}'::jsonb,
    synced_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists studio_token text unique;
```

Reads are scoped by `auth.uid()`; the sync route authenticates by
`studio_token` and writes on the owner's behalf with the service role.

---

## Visual direction

### The trap to avoid

Spider-Verse cosplay — halftone on everything, jagged speech bubbles, comic
lettering — reads as amateur and fights the word "professional". The film's
actual visual language is four devices, and each maps cleanly onto something an
observability product genuinely needs to express.

| Device | Meaning it carries here |
|---|---|
| **Halftone / Ben-Day dots** | Density = data volume. Denser dot fields where there is more activity |
| **Chromatic offset** (red/cyan ghosting) | Reserved for exactly one meaning: **a scraper is drifting.** The interface goes out of register when the data goes out of register |
| **Comic panel gutters** | Hard white gutters between irregularly sized panels, replacing eight identical rounded cards |
| **Web lines / action lines** | Structural in the hero; the connector spine in every timeline |

Each device has one job. A device used decoratively is a bug.

### Tokens

```
--paper      #FAF8F4   warm off-white (replaces the cold #fcfcfd)
--surface    #FFFFFF   panel fill
--ink        #0B0B0F
--muted      #55555F
--faint      #8A8A95
--gutter     #EDEAE3   panel separation

--web        #1B4FD8   Bright Data blue — structure, links, live state
--venom      #D6183B   Spider red — a break, a repair in flight
--verified   #0A7A4F   green — a repair that held
```

Nothing outside those three accents is ever coloured.

### Type

- **Mono — keep.** JetBrains Mono for machine truth: collector IDs, timestamps,
  field names. This is already correct in the current build.
- **Display — replace.** Instrument Serif is well-chosen but it is the tasteful-
  startup default and it is part of why the site reads templated. Replace with
  a heavy condensed grotesque for headlines: poster energy, still professional.
- **Body — keep** the current UI sans.

### The rule that kills the template feel

**No more than two panels on any screen may share the same dimensions.** Panel
size is how hierarchy gets expressed once every panel stops being a rounded
card. Sized by importance and by data volume, not by grid convenience.

### Motion

Motion exists to show state change, never to decorate. Compositor-friendly
properties only (`transform`, `opacity`, `clip-path`). Every animation has a
static end state under `prefers-reduced-motion`.

---

## The spider web hero

`tool_groups.js` ships prebuilt scrapers for 27 real brands: amazon, apple,
bestbuy, booking, chatgpt, crunchbase, ebay, etsy, facebook, github, google,
grok, homedepot, instagram, linkedin, npm, perplexity, pypi, reddit, reuters,
tiktok, walmart, x, yahoo, youtube, zara, zillow, zoominfo. Real data, not
invented.

**Act one.** Dense radial web. Bright Data mark at centre. The 27 names caught
in the strands as wordmarks. Faint pulses travel inward along the silk.

> **Bright Data has already caught these.**

**Act two — on scroll, the camera pulls back.** The web shrinks to a small
bright knot. The field around it fills with thousands of faint unnamed dots.
The web does not grow; the space around it does.

> **The web is 27 sites. There are two hundred million others.**
> **Scraper Studio is for the ones nobody built a scraper for.**

**Why the inversion matters.** Presented straight, 27 logos caught in a web
advertises Bright Data's prebuilt library — the very thing this project
differentiates against — and brushes the hackathon rule that Amazon, LinkedIn
and Instagram are off limits as demo targets. Inverted, the same graphic names
them as *already handled* and makes the long tail the product. The spider, the
web, and the food all survive; only the argument changes.

**Implementation constraints:**

- One inline SVG. No canvas, no animation library.
- Scroll driven by `IntersectionObserver` + CSS transforms, not a scroll handler.
- Brand names set as **wordmarks in our own typeface** — not 27 sourced brand
  SVGs. Cheaper, visually coherent, and it keeps real trademarks out of a
  "food" metaphor.
- `prefers-reduced-motion` renders act two's end state directly.

---

## Routes

### Public

| Route | Contents |
|---|---|
| `/` | Hero → spider web (two acts) → the loop, as connected panels rather than a numbered list → one live record from the newest run → **live GitHub Actions run history** → track-fit strip → footer |
| `/submission` | Judge view of *our* account. The `/app` views, read-only, no sign-in, plus the honest-limits panel |
| `/login` | Google sign-in |

### Signed in

| Route | Contents |
|---|---|
| `/app` | **Overview.** Health mosaic — one panel per scraper, sized by row volume, chromatic-offset while drifting · live activity stream · next cron countdown · credit burn from `budget_status` |
| `/app/s/[domain]` | **One scraper.** Its life as a horizontal timeline: built → runs → break → repair → verified. Schema watch showing which fields are observed and which went quiet · last sample rendered as records, not a `<pre>` dump · **Run now** / **Repair now** · collector ID, source URL, created date |
| `/app/repairs` | **Every repair, across every scraper.** Each entry: what broke → the exact prompt sent → what came back → the verification run that proved it, with a before/after field diff |
| `/app/connect` | Onboarding. Bright Data key → generated `.mcp.json` carrying both tokens → the prompt to try → sync status: has this account's MCP server ever checked in? |
| `/app/settings` | Email on break and repair · rotate `STUDIO_TOKEN` · sign out |

Today's `/dashboard` — a setup wizard named "dashboard" — becomes
`/app/connect`. `/app` becomes what a dashboard should be.

### Two details that carry disproportionate weight

**`/app/repairs` earns its own route.** Self-healing is the scored criterion
and the hackathon's flagged hero project. Rendered as a column in a table with
a pill, it disappears. Rendered as a page where each repair is a legible
narrative, it is the submission.

**Live GitHub Actions history on `/`.** Track 5 asks for "a wall of green
checks to prove it". The current page *links* to the Actions tab.
`GET /repos/{owner}/{repo}/actions/workflows/scrape.yml/runs` is public and
needs no auth. Rendering the runs inline is real, live, unfakeable evidence for
zero infrastructure.

### Trigger buttons

**Run now** and **Repair now** call the same server-side paths the cron uses.
They are conveniences over an agent-canonical system, never a second
implementation. Scraper *creation* stays agent-only: it takes 5–10 minutes and
does not belong behind a button that looks like it should respond immediately.

---

## Track fit

The nine hackathon project tracks are positioning material, not a backlog. With
three days remaining, new features are how this ends up unfinished. The landing
page carries a short strip stating honestly which tracks the project hits:

| Track | Status |
|---|---|
| 04 — Self-healing scraper *(hero project)* | The whole product |
| 05 — Scrapers in CI, no humans | The six-hourly Actions cron, with its run history shown live |
| 02 — Prompt-to-production pipeline | The cron plus the committed registry |
| 01 — One-prompt scraper | `scraper_ensure` |

Claiming only what is true is worth more than claiming all nine.

---

## Build order

Sequenced by deadline risk, not by build logic.

| Phase | Work | Rationale |
|---|---|---|
| **0** | Seed 4–5 domains, induce 2 real breaks, let the loop repair them | Wall-clock bound and serial. Everything else is worthless without it. **Runs in the background from the start** |
| **1** | Design system: tokens, panel grammar, halftone / offset / web primitives, shared components (health panel, timeline, record card, run log) | Every page below is assembled from these |
| **2** | `/` landing including the spider web | Highest presentation value; entirely independent of the data layer |
| **3** | Supabase schema, `STUDIO_TOKEN` sync, `/app`, `/app/s/[domain]`, `/app/repairs` | The real flow |
| **4** | `/app/connect`, `/app/settings` | Depends on phase 3's token |
| **5** | `/submission` | Phase 3's components pointed at our account with auth off |

`/submission` is last on purpose, and it is the opposite of a deprioritisation:
by phase 5 it is an afternoon, because every component already exists. Built
first, it gets built twice.

**Degradation path.** If phases 3–4 run out of time, they collapse to: `/app`
shows the shared registry, sign-in gates onboarding and email alerts only, and
the honest-limits panel says so plainly. That copy already exists on
`/submission` today — it must be kept, not deleted.

---

## Copy consistency

Three strings currently contradict where this is heading and must be revisited
once phase 3 lands, or a judge will catch the inconsistency:

- `/submission`: "This view comes down after judging."
- `/submission`: "Per-user registries are the next piece of work, not a shipped
  feature."
- `/dashboard`: "Per-account scraper tracking is the next piece of work."

If the sync ships, all three are false. If it does not, the landing page's
multi-tenant framing is false. They resolve together, in whichever direction
phase 3 actually lands.

---

## Out of scope

- Dark mode
- The chat feature (explicitly deferred; non-functional showcase)
- Scraper creation from the browser
- Team or workspace concepts
- Any hackathon track not listed in the track-fit table
