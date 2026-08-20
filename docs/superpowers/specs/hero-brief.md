# Build brief — landing page hero

Self-contained task for a coding agent. You have no prior context on this
repo; everything you need is below.

---

## The repo in four sentences

`d:\Projects\BrightData` is a fork of Bright Data's MCP server that adds a
self-healing custom-scraper lifecycle. `dashboard/` is a **separate** Next.js
16 app (App Router, Turbopack, React 19, Tailwind v4) that visualises it.
`brightdata-mcp-studio/` is the MCP server — **do not touch it for this task.**
Read `CLAUDE.md` at the repo root for house style before writing code.

Full design spec, for context you may want:
`docs/superpowers/specs/2026-08-20-dashboard-ui-design.md`. This brief
implements its "spider web hero" section. Where the two disagree, this brief
wins.

Run `cd dashboard && npm run dev`.

---

## Task 1 — the spider-web hero (the whole job)

Replace the current text-only hero on `dashboard/src/app/page.tsx` with a
two-act scroll piece. **Everything below this line is Task 1. Do it, verify
it, stop. Tasks 2 and 3 are optional extras at the bottom.**

### The argument the graphic has to make

Bright Data ships ~27 prebuilt scrapers for named brands. This project is for
every site they *didn't* build one for. The graphic must land that inversion,
in two acts:

**Act one.** A dense radial spider web. The Bright Data mark at the centre.
The brand names caught in the strands as wordmarks. Faint pulses travel inward
along the silk.

> **Bright Data has already caught these.**

**Act two — on scroll, the camera pulls back.** The web shrinks toward a small
bright knot. The field around it fills with thousands of faint unnamed dots.
**The web does not grow — the space around it does.**

> **The web is 27 sites. There are two hundred million others.**
> **Scraper Studio is for the ones nobody built a scraper for.**

Why the inversion matters, so you don't "improve" it away: presented straight,
27 brand logos in a web advertises the *prebuilt library*, which is the exact
thing this project differentiates against — and the hackathon forbids Amazon /
LinkedIn / Instagram as demo targets. Inverted, the same graphic names them as
*already handled* and makes the long tail the product.

### Where the names come from

`brightdata-mcp-studio/tool_groups.js` — grep for the `web_data_*` tool names
and derive the brands from them. **Do not trust the count of 27**; the spec
says 27 but lists 28. Use whatever is actually in the file and make the copy
match the real number.

Set them as **wordmarks in the site's own display typeface** — do NOT source
27 brand SVG logos. Cheaper, visually coherent, and it keeps real trademarks
out of a "food" metaphor.

### Hard implementation constraints

- **One inline SVG.** No canvas, no animation library, no new dependency.
- Scroll driven by `IntersectionObserver` + CSS transforms. **No scroll
  handler**, no `scroll` event listener.
- Animate `transform` / `opacity` / `clip-path` only. Never `width`, `height`,
  `top`, `left`, or `font-size`.
- `prefers-reduced-motion: reduce` must render **act two's end state directly**
  — static, legible, no motion. The global reduced-motion block already exists
  at the bottom of `globals.css`; make sure your work degrades correctly under
  it rather than fighting it.
- The dots in act two are decorative *volume*, not data. Generate them
  deterministically (a seeded loop), not with `Math.random()` — the page is
  server-rendered and a random field causes hydration mismatch.
- Keep it under ~250 lines. If it needs more, split the SVG into its own
  component file under `src/components/`.

### Use the existing design system — do not invent a second one

Tokens live in `dashboard/src/app/globals.css` under `@theme`. Use them.

**Colour — this is a rule, not a preference.** Only three accents exist and
each carries exactly one meaning:

| Token | Means |
|---|---|
| `web` (#1b4fd8) | structure, links, live state — **the silk is this** |
| `venom` (#d6183b) | something is broken / a repair in flight |
| `verified` (#0a7a4f) | a repair that held |

Nothing else on the page is coloured at all. The hero is structure, so it is
`web` on `paper`. **Do not introduce a gradient, a purple, or a second blue.**

Neutrals: `paper` `surface` `raised` `ink` `muted` `faint` `gutter`
`hairline`.

**Type scale — use the tokens, never a raw px size.** A fluid scale was added
in commit `bebe59f`; the codebase now contains zero `text-[13px]`-style
literals and it must stay that way.

```
text-micro  text-meta  text-body  text-read  text-lead  text-sub  text-head
```

Each is a `clamp()` pinned to its old value at 1440px and growing to ~127% by
2560px. For the big headline use a `clamp(min, vw, max)` inline, matching the
existing pattern in `page.tsx`.

Containers: `max-w-page` and `max-w-column` (both fluid). Not `max-w-6xl`.

Existing utilities you should reuse rather than reimplement: `.panel`,
`.panel-loud`, `.halftone`, `.halftone-fade`, `.web-strand`, `.rise`,
`.draw-in`, `.pulse`, `.tabular`.

**Style rules:** 4-space indent in `.css`, 2-space in `.tsx`. Comments explain
*why*, never *what*. No dead code, no commented-out blocks, no `console.log`.

### Do not touch

- Anything under `brightdata-mcp-studio/`
- `src/lib/**` (data layer — registry, dataset, actions, supabase)
- `src/app/app/**` and `src/app/submission/**` (the dashboard routes)
- `src/components/app/**`
- `dashboard/AGENTS.md` / `dashboard/CLAUDE.md` — regenerated by `next dev`

Your blast radius is `src/app/page.tsx` plus any new file you create under
`src/components/`.

### Verification before you call it done

1. `npx tsc --noEmit` — clean.
2. `npm run build` — succeeds.
3. Load `/` at **375, 768, 1440, and 2560** wide. No horizontal overflow at
   any of them. The headline must not overflow at 375.
4. Toggle reduced-motion on and reload. Act two's end state renders, and the
   copy is readable.
5. Both acts' copy is legible against the background at every width.
6. `grep -rn "text-\[[0-9]" dashboard/src` returns nothing.

Commit as `feat: <description>` — no attribution footer, no co-author line.

---

## Task 2 — only if Task 1 is finished and verified

The spec has a rule the current dashboard breaks:

> No more than two panels on any screen may share the same dimensions.

`/app` and `/submission` are a stack of full-width rectangles. Vary panel size
by importance and by data volume. **Do not restyle — resize and recompose.**
Touching `src/components/app/**` is allowed for this task only.

## Task 3 — only after Task 2

Three strings claim per-user data that does not exist. Multi-tenant sync was
never built, so they are false today. Find and rewrite them honestly:

- `/submission`: "This view comes down after judging."
- `/submission`: "Per-user registries are the next piece of work, not a
  shipped feature."
- the connect/onboarding view: "Per-account scraper tracking is the next piece
  of work."

Grep for them; the wording may have drifted.

---

## Known trap

`dashboard/src/app/app/s/[domain]/page.tsx` and
`dashboard/src/app/submission/s/[domain]/page.tsx` render the **same**
`Detail` component. If you change its props you must update both, and the
public one is the one that actually gets looked at. Same pattern for `Verdict`,
`Mosaic`, `Feed`, `Watch`, `Machine` across `/app` and `/submission`.
