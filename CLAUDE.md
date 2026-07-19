# CLAUDE.md — context for Claude Code

This file orients a fresh Claude Code session. The project was built
collaboratively in a separate chat; this is the handoff. Read it, then the
README, then `src/lib/types.ts` (the data contract) before making changes.

## What this is

Global Tech Monitor — a pipeline view of a technology from research through
scaling, adoption, and public investment. Vertical 01 is quantum computing.
It's meant as a research instrument for a policy audience (Hoover/TFL), not a
consumer dashboard. Reference point for the design and framing is ASPI's
Critical Technology Tracker: lead with country comparison, treat data-viz as
the hero, look like an instrument.

## Stack and why

- **Vite + React + TypeScript.** Types matter here because entries have a real
  shape and the project grows by adding verticals.
- **A Node fetch script** (`scripts/fetch-data.ts`) runs server-side — on a
  daily GitHub Action — and writes `public/data.json`. The app reads that JSON,
  so the page is static, instant, and works on GitHub Pages with no server.
  Fetching server-side is deliberate: it dodges browser CORS limits and is
  where patent/funding sources live.
- **GitHub Action** (`.github/workflows/build-and-deploy.yml`) fetches daily at
  07:00 UTC, commits the updated data.json back (so trend history accumulates),
  builds, and deploys to Pages.

## Data sources and their honesty caveats

- **Innovation** — OpenAlex (has institution country codes → real actor
  attribution) with an arXiv fallback (no country data). Needs `OPENALEX_KEY`.
- **Patents** — EPO OPS, feeds innovation stage. Needs `EPO_KEY` + `EPO_SECRET`.
  Schema is fiddly; if patents come back empty, inspect the raw response first.
- **Scaling / adoption** — hand-curated in `data/seed.ts`. No clean live feed
  exists for these; that gap is real, not a bug.
- **Investment** — NSF Awards (US), public, no key. There is NO public
  machine-readable feed for China's NSFC, so this stage is US/EU-weighted by
  construction. The UI says so explicitly. Do not fabricate a China number.

Every external source fails soft — a missing key or down endpoint drops that
one source without breaking the build.

## Actor attribution

Assigned from institution country codes (OpenAlex), not keyword guessing.
`src/lib/actorFromCountry.ts` is the logic; `src/lib/inferActor.ts` is the
weaker keyword fallback used only on the arXiv path. Every entry carries an
`actorEvidence` string so any classification is auditable. Treat attribution as
a lead, not a verdict — say so in anything user-facing.

## Design system

v3, "tightened instrument" — a deliberate rebuild after v2 (Garamond + big
serif hero) read as generic/AI-templated. Rules, not vibes:

- **One radius value** (`--r: 6px`), used everywhere — cards, pills, badges,
  tags. Never introduce a second radius.
- **Borders, not shadows.** Every panel is `.panel`: a 1px border, no
  box-shadow. Nothing floats.
- **Inter, one type ramp, no serif.** Adobe Garamond Pro is gone — this isn't
  a magazine, it's an instrument. Headings are bold sans at a handful of fixed
  sizes, not display type.
- **Color is spent on two things only:** Hoover Red (#98002e) as the single
  brand accent (one highlighted KPI, the primary button, the forecast tag —
  never more than a small handful of elements at once), and actor colors
  (`--us` / `--cn` / `--eu` / `--other`) which exist *only* to encode real
  country data in bars/badges/dots. Never use a color decoratively. No
  gradients, no icon-bubble chrome that doesn't mean anything.
- **Reuse one component for one job.** `BarRow` renders both the actor-share
  and stage-share panels — don't fork a second bar component for the same
  visual job. Resist wrapping things in cards-inside-cards.
- **8pt spacing grid.** Paddings/gaps are 4/8/16/24px, never arbitrary.

Tokens live at the top of `src/styles/index.css`. Do not drift back toward
the Garamond/hero-serif look, and don't reach for shadows, gradients, or a
second radius value just because a reference screenshot has them — translate
the *information architecture* of a reference, not its literal chrome.

## Interactivity

Charts and breakdowns are meant to be explored, not just looked at:
- Hover any bar row, map dot, or chart point → a tooltip with the real
  underlying number (see `Tooltip.tsx`, `BarRow.tsx`).
- Click an actor bar/dot → toggles the global actor filter.
- Click a stage bar → scrolls to that stage's pipeline column.
- Click an institution row → highlights that org's entries in the innovation
  column (dims the rest) rather than navigating away.
Never fabricate a number to make a chart feel richer — the KPI deltas and the
forecast line are real (period-over-period comparisons, linear extrapolation
of `trend[]`), and they disappear/omit rather than show a made-up figure when
there isn't enough history yet. Keep it that way when adding new panels.

## Things to preserve

- The `live` vs `seeded` provenance label on entries — the UI must never imply
  curated data is a live feed.
- The China-funding caveat in the investment section.
- Soft-fail on every fetch source.
- The daily commit of data.json (trend accumulation depends on it).

## How to extend

- New scaling/adoption entries → `data/seed.ts` (one typed object each).
- Analyst "so what" notes → `data/notes.ts` (one per stage, newest shown).
- New technology vertical → parameterize `TECH` and the query in the fetch
  script; the types are technology-agnostic.
- Funding is US/EU only until a PRC source exists — don't paper over it.

## House style (for any prose: notes, copy, READMEs)

Lyrical but plain. Specific numbers stated without hedging. No colons as clause
separators. Light interpretive touch at paragraph ends, not a thesis. Avoid the
LLM tells (delve, underscore, pivotal, "not just X but Y", rule-of-three
padding). Prefer "is/has" over "serves as/features". State the fact, stop.

## Commands

```
npm install
npm run fetch-data   # writes public/data.json (watch the source lines it prints)
npm run dev
npm run build
npm run typecheck
```

On the first real fetch, confirm it prints "OpenAlex: N works", "NSF: N grants",
"EPO: N patents" rather than skip messages. A skip means that key isn't set.
