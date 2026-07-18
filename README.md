# Global Tech Monitor

A pipeline view of a technology from research through scaling to adoption.
Vertical 01: **quantum computing.**

Three stages, left to right:

1. **Innovation** — research and invention (live from the arXiv API).
2. **Production / scaling** — hardware milestones and fab capacity (curated).
3. **Adoption** — commercial and government use (curated).

Every entry is tagged by actor (US / China / Europe / Other), inferred from
author affiliation. Filter the whole board by actor. Entries are labeled `live`
or `seeded` so the board never implies a curated milestone is a live feed.

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
scripts/fetch-data.ts     nightly data build (Node)
data/seed.ts              curated scaling/adoption entries — edit by hand
src/lib/types.ts          the data contract
src/lib/inferActor.ts     affiliation → actor heuristic (shared)
src/components/            Card, StageColumn
src/App.tsx               state, filters, live refresh
src/styles/index.css      Hoover brand tokens
```

## Method & honesty notes

- **Actor inference is a keyword matcher, not authority.** arXiv rarely
  populates structured affiliation, so it reads names and institutions from
  text. A PRC national at a US lab reads as US. `actorEvidence` records why each
  call was made. Treat it as a lead.
- **Stage 02 is deliberately thin.** Production/scaling has no queryable feed;
  those entries are hand-curated milestones. That gap is a real feature of the
  domain, not a bug in the tool.

Branded to the Hoover Institution 2023 brand guide (Hoover Red #98002E, Pantone
404 warm gray, Garamond display). Not an official Hoover product.
