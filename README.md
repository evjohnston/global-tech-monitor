# Global Tech Monitor

A pipeline view of a technology from research through scaling to adoption.
Vertical 01: **quantum computing.**

Three stages, left to right:

1. **Innovation** — research and invention. Live from **OpenAlex**, which gives
   each work its authors' institution country codes, so actor attribution is a
   real lookup, not a keyword guess. Falls back to arXiv if OpenAlex is down.
2. **Production / scaling** — hardware milestones and fab capacity (curated).
3. **Adoption** — commercial and government use (curated).

Above the pipeline, an **actor-share trend chart** shows how each country's
share of quantum preprints moves over time — built by accumulating one data
point per daily run. Each stage leads with a dated **analyst note**, the
"so what" for a reader with ten minutes, above the raw feed.

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

## Stack

- **Vite + React + TypeScript** for the app.
- **A Node fetch script** (`scripts/fetch-data.ts`) that pulls arXiv server-side
  and writes `public/data.json`. Running server-side sidesteps browser CORS
  limits and is where patent scraping slots in later.
- **GitHub Actions** runs the fetch daily, rebuilds, and deploys to Pages.

The app reads a committed JSON file, so the page loads instantly and needs no
running server. A browser-side "refresh from arXiv" button tops up the newest
papers between nightly runs.

## Run locally

```bash
npm install
npm run fetch-data   # writes public/data.json
npm run dev          # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`.

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

**Add patents to Stage 01** — add a `fetchPatents()` to `scripts/fetch-data.ts`
returning `Entry[]` with `source: "patent"`, and merge it alongside arXiv. This
is why fetching lives in Node: patent sources have no browser-friendly CORS API.

**Add a new technology vertical** — the type system (`src/lib/types.ts`) is
technology-agnostic. Parameterize `TECH` and the arXiv category in the fetch
script, duplicate the seed file, and you have Vertical 02.

## Files

```
scripts/fetch-data.ts       nightly data build — OpenAlex + arXiv fallback, trend accumulation
data/seed.ts                curated scaling/adoption entries — edit by hand
data/notes.ts               analyst "so what" notes — edit by hand
src/lib/types.ts            the data contract
src/lib/actorFromCountry.ts country code → actor (OpenAlex path)
src/lib/inferActor.ts       affiliation keyword heuristic (arXiv fallback only)
src/components/             Card, StageColumn, NoteCard, TrendChart
src/App.tsx                 state, filters, live refresh
src/styles/index.css        Hoover brand tokens
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

Branded to the Hoover Institution 2023 brand guide (Hoover Red #98002E, Pantone
404 warm gray, Garamond display). Not an official Hoover product.
