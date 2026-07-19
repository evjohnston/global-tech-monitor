# Global Tech Monitor

A pipeline view of a technology from research through scaling to adoption.
Vertical 01: **quantum computing.**

Four stages, plus data-visualization up top:

1. **Innovation** — research (OpenAlex, with arXiv fallback) and patents (EPO).
2. **Production / scaling** — hardware milestones (hand-verified floor + live RSS).
3. **Adoption** — commercial and government use (hand-verified floor + live RSS).
4. **Investment** — public research funding (NSF; US/EU only, see caveat).

Above the pipeline: KPI cards with real period-over-period deltas, a
country breakdown, a real interactive world map, a stage breakdown, an
institution leaderboard, a recent-entries table, and a country-share trend
chart with a linear-projection tail. Every one of those is interactive —
hover for the underlying number, click to filter or jump (the map included:
click any country to filter the whole page, or expand it to a full-page,
zoomable view). The design is a tightened instrument, not a dashboard
template: one border radius, borders instead of shadows, Hoover Red spent
on exactly one accent, country colors used only to encode real data. Rules
are in `CLAUDE.md`'s design-system section — read that before changing
`src/styles/index.css`.

Every entry logs its real country (ISO code) — there is no "Other" bucket
anywhere in the app. The July 2026 dataset resolves to 36 distinct real
countries, not four. Compact views (filter chips, bar lists) show the top 6
by volume, computed live; the map is where every country is visible,
however small its count. Entries are also labeled `live`, `seeded`, or
`auto` — three honesty tiers, so the board never implies a
keyword-classified RSS pickup is as solid as institution-attributed or
hand-verified data.

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

Without the key the fetch still runs, but it falls back to arXiv, which has
weak keyword-guessed country data — so the country filter and trend chart
have much less to work with.

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
proxy needed, OpenAlex's CORS is open) and hits the Worker for NSF funding
and scaling/adoption news (research.gov and two of the three news outlets
send no CORS headers, so those need the proxy). The news route pulls from
three quantum-industry RSS feeds, auto-classifies each item into scaling or
adoption by keyword, and tags it `auto` provenance — real automation, weaker
attribution than everything else in the app. EPO patents are wired up but
paused (that account is still being set up) — `/patents` soft-fails cleanly
until `EPO_KEY`/`EPO_SECRET` are set as Worker secrets. Full setup and exact
commands are in `CLAUDE.md` under "Live data (Cloudflare Worker)."

## Stack

- **Vite + React + TypeScript** for the app.
- **A Node fetch script** (`scripts/fetch-data.ts`) that pulls OpenAlex, EPO,
  and NSF server-side and writes `public/data.json`. Running server-side
  sidesteps browser CORS limits and is where the EPO secret lives.
- **GitHub Actions** runs the fetch daily, rebuilds, and deploys to Pages.
- **A Cloudflare Worker** (`worker/`, optional) proxies EPO, NSF, and
  scaling/adoption RSS for live browser reads. Shares its fetch/transform
  logic with the Node script via `src/lib/sources/*` — one implementation
  per source, not two.

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
worker/                     Cloudflare Worker — live proxy for EPO + NSF + news RSS (separate deploy, own package.json)
src/lib/sources/            shared fetch/transform logic — OpenAlex, EPO, NSF, RSS (used by both the script and the Worker)
data/seed.ts                curated scaling/adoption entries — edit by hand, real country per entry
data/notes.ts               analyst "so what" notes — edit by hand
src/lib/types.ts            the data contract — Entry.country is the real ISO code, no Actor bucket type
src/lib/aggregate.ts        counts, period-over-period deltas, top-N-by-country, linear projection
src/lib/countries.ts        ISO country names + alpha-2/numeric bridging (wraps i18n-iso-countries)
src/lib/institutionCountry.ts  org-name → country-of-location keyword heuristic (arXiv/RSS fallback only)
src/components/             Card, StageColumn, NoteCard, TrendChart, BarRow, KpiCard, WorldMap, Tooltip, Leaderboard, RecentEntries
src/App.tsx                 state, filters, live refresh
src/styles/index.css        design tokens — one radius, borders not shadows, Hoover Red as the one accent
```

## Method & honesty notes

- **Country attribution comes from OpenAlex institution country codes** for
  roughly a third to two-thirds of innovation-stage entries — checked by
  hand, not assumed. A work is assigned to the modal country across its
  authors' institutions. `countryEvidence` on each entry records the country
  tally (or the keyword match, for `auto`-tier entries) so any call is
  auditable — hover the country badge on any card to see it. Works with no
  institution on record get `country: null`, honestly, rather than a guess
  or a catch-all bucket.
- **Stage 02/03 (scaling/adoption) have no clean API**, so a hand-verified
  seed set is the floor and a live RSS layer supplements it — real
  automation, but keyword-classified (`auto` provenance), the weakest
  attribution tier in the app. That gap between "no live feed exists" and
  "a perfect live feed" is real, not something the RSS layer fully closes.

Hoover Red (#98002E) is the one color carried over from the Hoover Institution
2023 brand guide; everything else is its own tightened instrument, not the
Pantone-404-and-Garamond brochure look. Not an official Hoover product.
