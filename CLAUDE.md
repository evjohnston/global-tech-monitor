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
  builds, and deploys to Pages. This keeps running — it's the only thing
  writing `trend[]`, and nothing below replaces it.
- **A Cloudflare Worker** (`worker/`) adds a live layer on top of that static
  base. On page load the browser fetches OpenAlex directly (open CORS, no
  secret needed) and hits the Worker for EPO patents and NSF funding — both
  need something a browser can't hold (a client secret, or CORS support that
  simply doesn't exist on research.gov). See "Live data" below.

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

## Live data (Cloudflare Worker)

`worker/` is a separate deployable (its own `package.json`/`wrangler.jsonc`),
not part of the Vite build. It proxies exactly two sources — EPO and NSF —
and nothing else; OpenAlex is CORS-open so the browser calls it directly
(`src/App.tsx` → `fetchLive()`). Both the Worker and the Node fetch script
import the *same* `src/lib/sources/{openalex,epo,nsf}.ts` modules, so
attribution logic can't drift between the live path and the nightly build.

Responses are cached at the edge for an hour — patents lag ~18 months and NSF
posts a few times a day, so there's no honest reason to hit either upstream
on every page load. CORS is locked to `ALLOWED_ORIGINS` (checked against the
request's `Origin` header), not left open with `*`.

**Deployed.** Live at `https://gtm-live-proxy.evjohnston.workers.dev`, under
the `evj@stanford.edu` Cloudflare account. `ALLOWED_ORIGINS` in
`wrangler.jsonc` already includes `https://evjohnston.github.io` alongside
the localhost dev ports. `VITE_WORKER_URL` is set both in `.env.local` (local
dev) and in `build-and-deploy.yml`'s Build step (production) — it's a public
URL, not a secret, so it's fine committed in the workflow file.

EPO_KEY / EPO_SECRET were deliberately skipped — that account is taking a
while to set up. `/patents` soft-fails cleanly (`{"error":"EPO key/secret not
set"}`) until they're added:
```
cd worker
npx wrangler secret put EPO_KEY             # paste when prompted
npx wrangler secret put EPO_SECRET
npm run deploy                              # re-deploy to pick them up
```

Redeploying after any other change to `worker/`: `cd worker && npm run
deploy` (already logged in — no need to re-run `wrangler login`).

Local dev doesn't need login: `cd worker && npm run dev` runs on
`localhost:8787` against `.dev.vars` (copy `.dev.vars.example`, fill in real
EPO creds if you want patents locally — NSF needs no key either way). Swap
`VITE_WORKER_URL` in `.env.local` to point at it instead of the deployed
Worker when iterating on `worker/` itself.

If `VITE_WORKER_URL` is unset, the app just skips patents/funding on the live
path and falls back to whatever the last static build had for those stages —
soft-fail, same as everywhere else in this project.

## Things to preserve

- The `live` vs `seeded` provenance label on entries — the UI must never imply
  curated data is a live feed.
- The China-funding caveat in the investment section.
- Soft-fail on every fetch source, including the Worker's two proxied routes.
- The daily commit of data.json (trend accumulation depends on it — the
  Worker is additive freshness on top, not a replacement for this).
- One shared implementation per source (`src/lib/sources/*`) — if you touch
  attribution or transform logic for OpenAlex/EPO/NSF, edit it there once,
  not in the Node script and the Worker separately.

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

cd worker
npm install
npm run dev          # local proxy on :8787, no login needed
npm run deploy       # needs `npx wrangler login` first
npm run typecheck
```

On the first real fetch, confirm it prints "OpenAlex: N works", "NSF: N grants",
"EPO: N patents" rather than skip messages. A skip means that key isn't set.
