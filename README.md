# Global Tech Monitor

A pipeline view of a technology from research through scaling to adoption.
Vertical 01: **quantum computing.**

Four stages, plus data-visualization up top:

1. **Innovation** — research (OpenAlex, with arXiv fallback) and patents (EPO).
2. **Production / scaling** — hardware milestones (curated).
3. **Adoption** — commercial and government use (curated).
4. **Investment** — public research funding (NSF; US/EU only, see caveat).

Above the pipeline: KPI cards with real period-over-period deltas, an
actor-share breakdown, a "where the work happens" diagram, a stage breakdown,
an institution leaderboard, a recent-entries table, and an actor-share trend
chart with a linear-projection tail. Every one of those is interactive —
hover for the underlying number, click to filter or jump. The design is a
tightened instrument, not a dashboard template: one border radius, borders
instead of shadows, Hoover Red spent on exactly one accent, actor colors used
only to encode real country data. Rules are in `CLAUDE.md`'s design-system
section — read that before changing `src/styles/index.css`.

Every entry is tagged by actor (US / China / Europe / Other) and labeled `live`
or `seeded` so the board never implies a curated milestone is a live feed.

## OpenAlex key (recommended)

OpenAlex gives a free daily quota with a free key. Get one at
`https://openalex.org/settings/api`, then add two repo secrets under
**Settings → Secrets and variables → Actions**:

- `OPENALEX_KEY` — your key
- `OPENALEX_MAILTO` — your email (OpenAlex asks callers to identify themselves)

Locally, export them before running the fetch:

```bash
export OPENALEX_KEY=your-key
export OPENALEX_MAILTO=you@example.com
npm run fetch-data
```

Without the key the fetch still runs, but it falls back to arXiv, which has no
country data — so the actor filter and trend chart go quiet.

## Patents and funding keys (optional)

- **Patents (EPO OPS)** — free tier, needs OAuth credentials. Register at
  `https://developers.epo.org`, then set `EPO_KEY` and `EPO_SECRET` as repo
  secrets. Without them the patent source is skipped (build still succeeds).
- **Funding (NSF)** — public, no key needed. Works out of the box. There is no
  equivalent public machine-readable feed for China's NSFC, so the investment
  view is US/EU-weighted by construction; the UI says so.

Every external source fails soft — a missing key or a down endpoint drops that
one source without breaking the build.

The same EPO credentials get set in **two** places once you add the live
Worker below: as GitHub Actions secrets (for the nightly build) and again as
`wrangler secret put` values (for the Worker). They're the same key/secret
pair, just registered with two separate deploy targets.

## Live data

The nightly build above is the base layer. `worker/` is a small Cloudflare
Worker, **deployed** at `gtm-live-proxy.evjohnston.workers.dev`, that adds a
live layer on top: on page load, the browser fetches OpenAlex directly (no
proxy needed, OpenAlex's CORS is open) and hits the Worker for NSF funding,
which a browser can't fetch on its own — research.gov sends no CORS headers
at all. EPO patents are wired up but paused (that account is still being set
up) — `/patents` soft-fails cleanly until `EPO_KEY`/`EPO_SECRET` are set as
Worker secrets. Full setup and exact commands are in `CLAUDE.md` under "Live
data (Cloudflare Worker)."

## Stack

- **Vite + React + TypeScript** for the app.
- **A Node fetch script** (`scripts/fetch-data.ts`) that pulls OpenAlex, EPO,
  and NSF server-side and writes `public/data.json`. Running server-side
  sidesteps browser CORS limits and is where the EPO secret lives.
- **GitHub Actions** runs the fetch daily, rebuilds, and deploys to Pages.
- **A Cloudflare Worker** (`worker/`, optional) proxies EPO and NSF for live
  browser reads. Shares its fetch/transform logic with the Node script via
  `src/lib/sources/*` — one implementation per source, not two.

The app reads a committed JSON file, so the page loads instantly and needs no
running server even without the Worker. On top of that, it auto-refreshes
live on load (OpenAlex direct, EPO/NSF via the Worker if configured), plus a
manual "refresh live" button to re-trigger it.

## Run locally

```bash
npm install
npm run fetch-data   # writes public/data.json
npm run dev          # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`.

For the live Worker, in a separate terminal:

```bash
cd worker
npm install
npm run dev          # http://localhost:8787, no Cloudflare login needed
```
Then add `VITE_WORKER_URL=http://localhost:8787` to a `.env.local` at the repo
root (copy `.env.example`) so the app talks to it.

## Deploy to GitHub Pages

1. Push to a GitHub repo, branch `main`.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow (`.github/workflows/build-and-deploy.yml`) deploys on push and
   every day at 07:00 UTC. The base path is set to the repo name automatically;
   for a custom domain or user site, set `GTM_BASE=/` in the workflow.

## Extend it

**Edit analyst notes** — `data/notes.ts`. One `StageNote` per stage; only the
most recent per stage is shown. This is the interpretation layer, write it in
your own voice.

**Add scaling / adoption entries** — edit `data/seed.ts`. Each entry is one
typed object; copy a block, change the fields, give it a unique `id`.

**Add a new source** — put the fetch/transform logic in `src/lib/sources/` as
a runtime-agnostic function (global `fetch`/`btoa` only, no Node- or
browser-only APIs) so both `scripts/fetch-data.ts` and, if it needs a secret
or lacks CORS, `worker/src/index.ts` can import the same implementation.

**Add a new technology vertical** — the type system (`src/lib/types.ts`) is
technology-agnostic. Parameterize `TECH` and the arXiv category in the fetch
script, duplicate the seed file, and you have Vertical 02.

## Files

```
scripts/fetch-data.ts       nightly data build — OpenAlex + arXiv fallback, trend accumulation
worker/                     Cloudflare Worker — live proxy for EPO + NSF (separate deploy, own package.json)
src/lib/sources/            shared fetch/transform logic — OpenAlex, EPO, NSF (used by both the script and the Worker)
data/seed.ts                curated scaling/adoption entries — edit by hand
data/notes.ts               analyst "so what" notes — edit by hand
src/lib/types.ts            the data contract
src/lib/aggregate.ts        counts, period-over-period deltas, share, linear projection
src/lib/actorFromCountry.ts country code → actor (OpenAlex path)
src/lib/inferActor.ts       affiliation keyword heuristic (arXiv fallback only)
src/components/             Card, StageColumn, NoteCard, TrendChart, BarRow, KpiCard, MiniMap, Tooltip, Leaderboard, RecentEntries
src/App.tsx                 state, filters, live refresh
src/styles/index.css        design tokens — one radius, borders not shadows, Hoover Red as the one accent
```

## Method & honesty notes

- **Actor attribution comes from OpenAlex institution country codes**, which
  is far better than parsing raw affiliation strings — but not perfect. A work
  is assigned to the modal country across its authors' institutions, with ties
  broken toward the first author. `actorEvidence` on each entry records the
  country tally so any call is auditable. Works with no institution on record
  fall to "other." If OpenAlex is unreachable, the arXiv fallback has no country
  data and everything reads as "other" until the next good run.
- **Stage 02 is deliberately thin.** Production/scaling has no queryable feed;
  those entries are hand-curated milestones. That gap is a real feature of the
  domain, not a bug in the tool.

Hoover Red (#98002E) is the one color carried over from the Hoover Institution
2023 brand guide; everything else is its own tightened instrument, not the
Pantone-404-and-Garamond brochure look. Not an official Hoover product.
