# CLAUDE.md — context for Claude Code

This file orients a fresh Claude Code session. The project was built
collaboratively in a separate chat; this is the handoff. Read it, then the
README, then `src/lib/types.ts` (the data contract) before making changes.

## What this is

Global Tech Monitor — a pipeline view of a technology from research through
scaling, adoption, and public investment. Multi-vertical as of 2026-07-19:
Vertical 01 is quantum computing, Vertical 02 is artificial intelligence, and
more critical/emerging technologies (biotechnology, semiconductors, space)
are the intended next additions — see "Multi-vertical architecture" below
before adding one. It's meant as a research instrument for a policy audience
(Hoover/TFL), not a consumer dashboard. Reference point for the design and
framing is ASPI's Critical Technology Tracker: lead with country comparison,
treat data-viz as the hero, look like an instrument.

## Multi-vertical architecture

Every technology tracked by this app is one entry in `VERTICALS`,
`src/lib/verticals.ts` — the single source of truth every fetch path reads
from (the nightly build script, and the Worker — though nothing calls the
Worker's routes from the frontend anymore as of 2026-07-20; see "Live data"
below).
A `VerticalConfig` carries: `id` (also the `public/data/<id>.json` filename
and `DataFile.technology` value), `number`/`label`/`shortLabel`/`tagline`
(topbar + pagehead display), `dataDir` (`data/<dataDir>/{seed,notes}.ts`),
`openAlexFilter` (a raw OpenAlex filter fragment), `arxivCategory` (the
break-glass fallback if OpenAlex itself is down), `epoCpcQuery` (a raw EPO
OPS CQL fragment), `fundingKeyword` (NSF Awards API keyword), and
`rssFeeds`/`rssClassifier` (that vertical's trade press + keyword
classifier). `src/lib/sources/{openalex,epo,nsf,rss}.ts` are tech-agnostic
machinery that take these as parameters — none of them hardcode a technology
anymore. `scripts/fetch-data.ts` loops over `VERTICALS` and writes one
`public/data/<id>.json` per vertical; `App.tsx` has a topbar tab per vertical
(`.vtab` buttons) that switches which data file is loaded — that's the whole
mechanism now, the frontend has no live-fetch path to configure per
vertical.

**Adding a vertical is real research work, not a config flag.** Each one
needs, checked by hand before it goes in `VERTICALS`:
- An OpenAlex filter that actually gets good institution-country coverage on
  a real sample (`primary_location.source.type:journal` restricted) — a
  Topic id if the field has one cohesive Topic (quantum: T10682), or a
  broader Subfield id if it doesn't (AI/ML: OpenAlex fragments "AI" across
  dozens of narrow application Topics with no dominant one, so it uses
  Subfield 1702 instead — checked institution-data quality by hand, 49/50
  sampled works had real structured country data).
- A real EPO CPC classification code (or an OR'd pair, if the field spans
  more than one — AI uses `G06N3 OR G06N20`, neural networks + machine
  learning specifically, since there's no single code the way quantum has
  G06N10). Verify against USPTO/WIPO CPC definitions, not from memory.
- A funding-source keyword for the NSF Awards API (or a different funding
  API entirely, if NSF's US-centric coverage is a bad fit for the field —
  biotechnology, for instance, might fit NIH grants better).
- Real, hand-verified RSS feeds from actively-publishing trade press (valid
  RSS 2.0, checked by curl) — see `QUANTUM_RSS_FEEDS`/`AI_RSS_FEEDS` in
  `verticals.ts` for the bar. Check each feed's `Access-Control-Allow-Origin`
  header too — the Worker proxies the ones that don't send one.
- A keyword classifier (`relevant`/`scaling`/`adoption` regexes) tuned
  against that vertical's real news vocabulary — reuse
  `DEFAULT_EXCLUDE_WORDS` from `rss.ts` for the generic personnel/podcast/
  funding-round noise filter, don't rewrite it per vertical.
- A `data/<dataDir>/seed.ts` floor of real, individually-verified scaling/
  adoption milestones (same standard as `data/quantum/seed.ts`: fetched and
  confirmed against the source URL before being added) and a
  `data/<dataDir>/notes.ts` analyst-note set (one per stage, house style
  below). The AI vertical's initial 171-entry seed set (77 scaling/94
  adoption, spanning 32 countries) was built by dispatching parallel research
  agents across distinct real-world domains (OpenAI/Anthropic; Google
  DeepMind/Meta/xAI/Mistral; AI hardware/data-centers; China's ecosystem;
  national government AI policy; commercial/enterprise adoption), each
  required to verify every claim against a real source URL — that's the
  effort level to expect per new vertical, not a quick pass.
- Register the new entries in `scripts/fetch-data.ts`'s
  `SEED_BY_VERTICAL`/`NOTES_BY_VERTICAL` maps (static imports — fine at this
  scale; revisit if the vertical list grows large).

## Stack and why

- **Vite + React + TypeScript.** Types matter here because entries have a real
  shape and the project grows by adding verticals.
- **A Node fetch script** (`scripts/fetch-data.ts`) runs server-side — on a
  scheduled GitHub Action, every 3 hours — and writes
  `public/data/<vertical-id>.json`, one per entry in `VERTICALS`. The app
  reads whichever JSON matches the active vertical tab, so the page is
  static, instant, and works on GitHub Pages with no server. Fetching
  server-side is deliberate: it dodges browser CORS limits and is where
  patent/funding sources live. **This script is now the app's only real
  ingestion path** (see "Live data" below for what changed 2026-07-20) — the
  frontend never calls OpenAlex/EPO/NSF/RSS itself.
- **GitHub Action** (`.github/workflows/build-and-deploy.yml`) fetches every 3
  hours, commits the updated data files back (so trend/entries history
  accumulates for every vertical), builds, and deploys to Pages. This keeps
  running — it's the only thing writing `trend[]` (and, since 2026-07-20, the
  only thing that ever pulls fresh data at all), and nothing below replaces
  it. Cadence was daily (07:00 UTC) until 2026-07-20; bumped to every 3 hours
  specifically to compensate for removing the browser's 3-minute live
  auto-refresh — see "Live data" below.
- **A Cloudflare Worker** (`worker/`) still exists and is still deployed, but
  as of 2026-07-20 the frontend doesn't call it. It used to add a live layer
  on top of the static base (the browser fetching OpenAlex directly plus the
  Worker proxying EPO/NSF/RSS on every page load and every 3 minutes after).
  That's gone — see "Live data" below for why, and don't wire the browser
  back up to it without re-reading that reasoning first.

## Data sources and their honesty caveats

- **Innovation** — OpenAlex, filtered by Topic T10682 ("Quantum Computing
  Algorithms and Architecture") restricted to journal-type sources, with an
  arXiv fallback. Needs `OPENALEX_KEY`. **Do not switch this back to
  filtering by arXiv-as-primary-location** — that was the original query and
  it was checked by hand to return 0/50 works with ANY institution data
  (arXiv doesn't collect structured affiliations, and OpenAlex essentially
  never backfills it for preprints, confirmed by sampling papers up to a
  year old). The Topic+journal filter gets real institution data on roughly
  a third to three-quarters of works (checked by hand, varies by date
  window), at the cost of lagging arXiv by weeks to months (journal
  publication time). That trade was made deliberately.
  When a work has no structured institution match, `fetchOpenAlex` tries
  OpenAlex's `raw_affiliation_strings` (free text OpenAlex still often
  carries even without a resolved institution record) as a secondary
  signal — both for a country guess via `institutionCountry.ts` and for an
  org name (text before the first comma). That fallback entry gets
  `provenance: "auto"`, not `"live"` — it's a text heuristic, not a lookup.
  **Never fall back to an author's name as the `org` value** — an
  individual person is not an institution, and doing this previously let
  something like "Anonymous" get aggregated in the institution leaderboard
  as if it were one prolific org with dozens of works. When there's truly
  no institution-shaped data, `org` is `""` (nothing shown), not a name.
  `fetchOpenAlexPages` pages past OpenAlex's 200-per-page cap (3 pages by
  default) — one implementation, shared by the nightly build and the
  one-time `backfill-trend`/`backfill-entries` scripts (the browser doesn't
  call this anymore; see "Live data" below).
- **Patents** — EPO OPS, feeds innovation stage. Needs `EPO_KEY` + `EPO_SECRET`.
  Schema is fiddly; if patents come back empty, inspect the raw response first.
- **Scaling / adoption** — two layers: a hand-verified floor in `data/seed.ts`
  (every entry fetched and confirmed against its source before being added),
  plus a live RSS layer (`src/lib/sources/rss.ts`) auto-classifying items
  from quantum-industry trade press (4 feeds now, including Quantum
  Zeitgeist which alone carries ~200 items/fetch vs. ~10 for the other
  three — checked by hand, it also carries a lot of listicle/explainer
  content the others don't, which is what the `EXCLUDE_WORDS` guide/"what
  is" patterns and the `QUANTUM_RELEVANT` topical gate are tuned against).
  The RSS layer is real automation, not hand-curation — but its stage/
  country calls are a keyword guess, weaker than everything else in this
  app. That's why it gets its own provenance tier (see below), not "live" —
  don't upgrade it to "live" without adding real verification, and don't
  delete `data/seed.ts` on the assumption RSS makes it redundant. It
  doesn't; the RSS classifier drops anything ambiguous.
- **Investment** — NSF Awards (US), public, no key. `NSF_N` is 300 — checked
  by hand, the awardapi accepts `rpp` up to at least 500 with no ceiling
  hit, so there's room to raise this further if the query volume grows.
  There is NO public machine-readable feed for China's NSFC, so this stage
  is US/EU-weighted by construction. The UI says so explicitly. Do not
  fabricate a China number.

Every external source fails soft — a missing key or down endpoint drops that
one source without breaking the build.

## Country attribution

v4 change: there is no `Actor` bucket type anymore (`us`/`cn`/`eu`/`other`
is gone from the codebase). Every `Entry` carries a real ISO 3166-1
alpha-2 `country` code (`src/lib/types.ts`), or `null` when a source
genuinely gives us nothing to go on. Nothing is bucketed into a catch-all
"other" — the July 2026 dataset resolves to 36 distinct real countries.
`src/lib/countries.ts` wraps `i18n-iso-countries` for names and for
bridging alpha-2 ↔ the numeric IDs `world-atlas`'s topojson uses; don't
hand-write a country name/code table, that package already has one.

Three provenance tiers, and the UI must keep them visually distinct:
- **`live`** — institution/awardee/filer country codes (OpenAlex
  Topic+journal path, NSF, EPO). Real data, no inference.
- **`seeded`** — hand-verified by a human against the source URL
  (`data/seed.ts`). Also real, just not automated.
- **`auto`** — keyword-inferred (`src/lib/institutionCountry.ts`), used on
  the arXiv fallback and the RSS news layer. This WILL misplace an
  organization when a text mentions multiple countries, or resolve to
  `null` when it names neither a place nor a recognized org. Every entry
  carries a `countryEvidence` string so any call is auditable, and
  `Card.tsx` shows it on hover of the country badge; RSS/arXiv entries
  append a note like "(auto-classified from X RSS, unverified)" — don't
  strip that qualifier when editing the transform code.

`src/lib/institutionCountry.ts` maps an ORGANIZATION NAME to the country
it's physically based in (headquarters/campus/site) — it is not, and must
never become, anything that infers a person's nationality or citizenship.
That distinction matters for what this code is actually for (bibliometric/
policy attribution of institutions, same as OpenAlex/NSF/ASPI do) and for
how it's described: keep comments and naming framed as "where is this
institution located," not "who does this person belong to."

Display uses full country names (`countryName()`), never the raw alpha-2
code — a badge that says "US" reads fine once, but a page full of two-
letter codes reads like a data table, not an instrument for a policy
reader. `COMMON_NAME` in `countries.ts` overrides a handful of ISO's
formal/political names (e.g. "People's Republic of China" → "China") with
the name people actually say — extend that table rather than reverting to
codes if a name reads oddly.

Color budget for country display, v4 (changed 2026-07-19): every country is
colored by continent — six tones (`--cont-na/-sa/-eu/-as/-af/-oc` in
`index.css`), applied via `countryColor()` in `src/lib/countries.ts`. This
replaced the earlier "US/China get brand colors, everyone else is neutral"
scheme — that's gone; `--us`/`--cn`/`--eu`/`--other` still exist as tokens
but are now reused only for pipeline STAGE color (innovation/scaling/
adoption/investment in `StageColumn.tsx`, `App.tsx`'s `STAGE_PIE_COLOR`,
`VolumeTrend.tsx`), a different semantic from country color — don't conflate
the two when touching either. `--cont-as` is deliberately a different red
from `--red` (the Hoover accent) so an Asian country badge never reads as
"the brand color." The continent lookup (`continentOf()`) reads from
`src/lib/continentMap.ts`, a generated static file — see
`scripts/gen-continent-map.ts` for why it's generated rather than importing
`world-countries` directly into client code (that package carries every
field for 250 countries; importing it straight into a browser-bundled module
cost 250KB+ of dead weight for the one field — `region`/`subregion` — this
app actually uses). Rerun `npm run gen-continent-map` only if the ISO
country list itself changes, which is rare.

Known tension, not yet resolved: `TrendChart.tsx`'s forecast now colors each
line by continent too, so two countries on the same continent (e.g. China
and India, both Asia) render as the same line color, distinguished only by
the legend/tooltip labels, not hue. That's a direct consequence of the
six-color continent scheme applied to a multi-line chart that used to have a
per-line rotating palette — flagged here rather than silently patched over,
in case it needs a per-chart tweak later.

Treat attribution as a lead, not a verdict — say so in anything user-facing.

## Design system

v3, "tightened instrument" — a deliberate rebuild after v2 (Garamond + big
serif hero) read as generic/AI-templated. Rules, not vibes:

- **Zero radius** (`--r: 0px`), used everywhere — cards, pills, badges,
  tags. v3 started at a small 6px radius; dropped to 0 on request for a
  squarer, more instrument-like read. Keep it at one value regardless —
  never introduce a second radius, even a second value of 0-ish intent.
- **Borders, not shadows.** Every panel is `.panel`: a 1px border, no
  box-shadow. Nothing floats.
- **Inter, one type ramp, no serif.** Adobe Garamond Pro is gone — this isn't
  a magazine, it's an instrument. Headings are bold sans at a handful of fixed
  sizes, not display type.
- **Color is spent on two things only:** Hoover Red (#98002e) as the single
  brand accent (one highlighted KPI, the primary button, the forecast tag —
  never more than a small handful of elements at once), and country colors
  (`--us` / `--cn` / `--other`, see "Country attribution" above) which exist
  *only* to encode real country data in bars/badges/the map. Never use a
  color decoratively. No gradients, no icon-bubble chrome that doesn't mean
  anything. `--eu` still exists as a token but is no longer a country
  bucket — it's only reused as one of `TrendChart`'s rotating line colors.
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
- Hover any bar row, map country, or chart point → a tooltip with the real
  underlying number (see `Tooltip.tsx`, `BarRow.tsx`).
- Click a country bar/map country → toggles the global country filter.
- Click a stage bar → scrolls to that stage's pipeline column.
- Click an institution row → highlights that org's entries in the innovation
  column (dims the rest) rather than navigating away.
Never fabricate a number to make a chart feel richer — the KPI deltas and the
forecast line are real (period-over-period comparisons, linear extrapolation
of `trend[]`), and they disappear/omit rather than show a made-up figure when
there isn't enough history yet. Keep it that way when adding new panels.

Panel set as of this writing: KPI row, innovation-over-time, output by
country, world map, entries by stage, top institutions, recent entries,
funding by country, innovation by source (paper/arXiv/patent — a read on
attribution quality, not just volume), provenance mix (live/seeded/auto
across everything tracked), and the country-share forecast. The source-mix
and provenance-mix panels exist specifically so the honesty tiers are a
first-class chart, not just a badge you'd only notice one card at a time.

## The world map

`WorldMap.tsx` is a real choropleth (`react-simple-maps` + `world-atlas`
topojson), not an illustrative diagram — every country with at least one
attributed entry is shaded by volume (sqrt-scaled so a couple of dominant
countries don't wash every smaller real country down to indistinguishable
gray). Compact view uses `countries-110m.json` (bundled, ~108KB); clicking
"expand" dynamically imports the higher-resolution `countries-50m.json`
(~750KB) so that cost is never paid by someone who never opens the full
map. Expand renders a fixed-position full-viewport overlay (own component
state, Escape key closes it) — not the browser's native Fullscreen API,
which needs a user-gesture dance across browsers this doesn't need.

**Time scrubber** (`TimeBar` in `WorldMap.tsx`): drags/plays through real
`trend[]` points, recoloring the choropleth to that date's actual recorded
counts — not an animation between two points, an actual different real
snapshot per frame. Only renders once `trend.length >= 3`; below that a
scrubber would just toggle between one or two points, not show a trend.
"Live" jumps back to the caller's current `counts` prop, which can be
fresher than the last recorded trend point. Needs real history to be worth
showing — see `scripts/backfill-trend.ts` below.

Compact-view chips/bars/KPIs show a caller-chosen top N (currently 6,
`TOP_N` in `App.tsx`) of whichever countries actually have the most volume
— computed from real data every render, never hardcoded to specific
countries. The map has no such cap; it's the place every real country,
however small its count, is actually visible. Don't add a second capped
view of the map data — if a panel needs to show "the rest," point at the
map rather than inventing another top-N list.

## Live data (Cloudflare Worker) — now dormant, frontend is static-store-only

**Changed 2026-07-20: the frontend no longer live-queries any source.**
Before this, `src/App.tsx` had a `fetchLive()` that ran on every page load
and on a 3-minute timer — the browser called OpenAlex directly (open CORS)
and hit the Worker for EPO/NSF/RSS, merging the result on top of the static
build client-side. That's gone. The frontend now does exactly one thing:
fetch `public/data/<vertical>.json` and render it. Nothing in `src/App.tsx`
calls OpenAlex, EPO, NSF, RSS, or the Worker anymore — `VITE_WORKER_URL` was
removed from `build-and-deploy.yml`'s Build step because nothing reads it.

Why: two different code paths (the nightly build vs. the browser's live
merge) could show two different pictures of "now" depending on when you
loaded the page, the "refreshed live" pulse and 3-minute auto-refresh
implied a streaming feed this app was never built to be, and the topbar's
green pulsing dot read as more real-time than a periodic poll actually is.
**Do not reintroduce a client-side fetch of any source module from
`src/App.tsx`** — if you want fresher data, the lever is the GitHub Action's
cron cadence (currently every 3 hours, bumped from daily specifically to
compensate for removing this), not a new browser-side fetch path.

`worker/` (its own `package.json`/`wrangler.jsonc`, not part of the Vite
build) is **still deployed, just unused** — left in place deliberately
rather than decommissioned, in case a future on-demand-refresh feature wants
it. It still proxies three routes — `/patents` (EPO), `/funding` (NSF),
`/news` (RSS) — and still imports the *same*
`src/lib/sources/{openalex,epo,nsf,rss}.ts` modules the nightly script does,
so if it's ever wired back up, attribution/classification logic still can't
drift between the two. Redeploying it (`cd worker && npm run deploy`) still
works exactly as before if you're testing it directly; nothing about its own
code changed.

The RSS feeds and classifiers are per-vertical config in
`src/lib/verticals.ts` (`QUANTUM_RSS_FEEDS`/`QUANTUM_RSS_CLASSIFIER`,
`AI_RSS_FEEDS`/`AI_RSS_CLASSIFIER`) — `src/lib/sources/rss.ts` itself is
tech-agnostic fetch/parse/classify machinery with no hardcoded feed list.
Checked by hand before adding any feed (must return valid RSS 2.0 XML from a
real, actively-publishing trade outlet for that vertical). Add more to the
relevant vertical's list in `verticals.ts`, not as a one-off fetch
somewhere else. Quantum's classifier (`scaling`/`adoption`/`exclude` regexes)
was tuned against real false positives — personnel/hiring announcements and
podcast episodes were both getting swept in on loose keyword overlap, and
money-amount words alone were catching private funding-round news that
doesn't belong in either stage; `DEFAULT_EXCLUDE_WORDS` in `rss.ts` carries
that baseline forward for every vertical. If you loosen a classifier, re-run
`npm run fetch-data` and read the actual `rss-*` entries it produces for
that vertical before trusting it.

Responses are cached at the edge for an hour — patents lag ~18 months and NSF
posts a few times a day, so there's no honest reason to hit either upstream
on every page load. CORS is locked to `ALLOWED_ORIGINS` (checked against the
request's `Origin` header), not left open with `*`.

**Deployed, unused by the frontend.** Still live at
`https://gtm-live-proxy.evjohnston.workers.dev`, under the
`evj@stanford.edu` Cloudflare account. `ALLOWED_ORIGINS` in `wrangler.jsonc`
still includes `https://evjohnston.github.io` alongside the localhost dev
ports. `VITE_WORKER_URL` was removed from `build-and-deploy.yml`'s Build
step 2026-07-20 (nothing reads it anymore) — it may still be set in your own
`.env.local` from before that change, which is harmless, just dead config.

EPO_KEY / EPO_SECRET now added (2026-07-19), in both places that need them —
they're independent, adding one doesn't feed the other:
- **Worker** (`/patents` on the live path): `cd worker && npx wrangler secret
  put EPO_KEY` then `npx wrangler secret put EPO_SECRET` — paste the value at
  the interactive prompt, never as the command-line argument (that pastes the
  key into shell history and, worse, into wrangler as the *secret's name*
  rather than its value — `npx wrangler secret list` will look wrong,
  showing your key material back as a "name," if this slips). Then `npm run
  deploy` to pick them up.
- **GitHub Actions** (nightly `npm run fetch-data`, which feeds `data.json`
  and `trend[]`): add `EPO_KEY`/`EPO_SECRET` (and `OPENALEX_KEY`, same
  category of miss) as repo secrets — Settings → Secrets and variables →
  Actions — and pass them through in `build-and-deploy.yml`'s "Fetch data"
  step `env:` block. Without that `env:` block the workflow step never sees
  them even once they're stored as repo secrets — `process.env.EPO_KEY` in
  `scripts/fetch-data.ts` reads empty either way, silently, since every
  source here fails soft.

Local dev doesn't need login: `cd worker && npm run dev` runs on
`localhost:8787` against `.dev.vars` (copy `.dev.vars.example`, fill in real
EPO creds if you want patents locally — NSF needs no key either way). This
is only useful for testing the Worker's own routes directly (`curl
localhost:8787/patents?...`) — there's no `VITE_WORKER_URL` wiring left in
the app to point at it.

## Things to preserve

- Real per-country attribution, never a regional bucket. If you're tempted
  to add back a `us`/`cn`/`eu`/`other`-shaped type for convenience, don't —
  derive whatever headline comparison you need (e.g. "US vs CN") directly
  from `entry.country` instead. This was a deliberate, requested removal.
- The `live` / `seeded` / `auto` provenance tiers on entries — the UI must
  never imply RSS-classified or arXiv-keyword-classified data is as solid as
  institution-attributed or hand-verified data.
- The China-funding caveat in the investment section.
- Soft-fail on every fetch source, including all three Worker-proxied routes
  (even though the frontend doesn't call them anymore — the Worker itself
  should still degrade gracefully if it's ever used again).
- The scheduled commit of `public/data/*.json` (trend AND entries
  accumulation both depend on it for every vertical). Since 2026-07-20 this
  GitHub Action run is the *only* thing that ever pulls fresh data — there
  is no more browser-side live layer on top of it, so don't reason about
  freshness as "static base + live topping" anymore, it's just "however
  current the last scheduled run is." The workflow's "Commit updated data"
  step does the actual commit (fixed 2026-07-19 — it was missing entirely
  before, so every run's accumulation was silently discarded after that
  run's deploy; see the workflow file's comment).
- One shared implementation per source (`src/lib/sources/*`) — if you touch
  attribution or transform logic for OpenAlex/EPO/NSF/RSS, edit it there
  once, not in the Node script and the Worker separately. Vertical-specific
  config (filters, CPC codes, keywords, feeds) lives in `verticals.ts`, not
  duplicated into the source modules themselves.
- `data/<vertical>/seed.ts` as the verified floor for scaling/adoption in
  every vertical, even though RSS supplements it live — don't let the live
  layer's existence become an excuse to stop hand-verifying new seed entries.

## How to extend

- New scaling/adoption milestones you want guaranteed correct →
  `data/<vertical>/seed.ts` (one typed object each, fetched and confirmed
  against its URL first).
- New RSS sources for a vertical's live scaling/adoption layer → that
  vertical's feed list in `src/lib/verticals.ts` (`QUANTUM_RSS_FEEDS`,
  `AI_RSS_FEEDS`, ...) — check the feed URL actually returns valid RSS from
  a real outlet before adding it.
- Analyst "so what" notes → `data/<vertical>/notes.ts` (one per stage,
  newest shown).
- New technology vertical → see "Multi-vertical architecture" above — add a
  `VerticalConfig` to `VERTICALS` plus a `data/<dataDir>/{seed,notes}.ts`
  pair; every fetch path picks it up automatically.
- Funding is US/EU only until a PRC source exists — don't paper over it.

## House style (for any prose: notes, copy, READMEs)

Lyrical but plain. Specific numbers stated without hedging. No colons as clause
separators. Light interpretive touch at paragraph ends, not a thesis. Avoid the
LLM tells (delve, underscore, pivotal, "not just X but Y", rule-of-three
padding). Prefer "is/has" over "serves as/features". State the fact, stop.

## Commands

```
npm install
npm run fetch-data       # loops over every VERTICALS entry, writes public/data/<id>.json each (watch the source lines it prints)
npm run backfill-trend -- <vertical-id>   # one-time: reconstructs past trend[] history from real OpenAlex dates (defaults to quantum-computing)
npm run backfill-entries -- <vertical-id> # one-off top-up: deep OpenAlex/NSF pull merged into entries[] (defaults to quantum-computing)
npm run gen-continent-map # regenerate src/lib/continentMap.ts (only if the ISO list changes)
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
"EPO: N patents", "RSS: N auto-classified scaling/adoption items" rather than
skip messages. A skip means that key isn't set (EPO) or every feed failed.

`backfill-trend` only needs to run once (or again if `trend[]` ever gets
reset/thinned) — it's not part of the nightly build, which keeps appending
one real point per day on its own. It reconstructs history from OpenAlex's
real `publication_date` field (a rolling 30-day window computed per past
day, exactly matching the live query's own math), not a fabricated curve —
see the comment at the top of `scripts/backfill-trend.ts` before changing it.

**`entries[]` accumulates across runs (fixed 2026-07-19).** `fetch-data.ts`
seeds its id-keyed merge map from the *previous* `data.json`'s `entries[]`
before layering this run's SEED/live/patents/funding/news on top — the same
accumulate-don't-replace pattern `trend[]` already used. Before this fix,
every nightly run silently discarded anything not present in that run's own
narrow pulls (a 30-day OpenAlex window, one day of RSS), which meant a
one-time deep backfill would just get wiped by the next regular fetch. If
you ever touch the `byId` construction in `main()`, keep the "start from
`prev?.entries`" line — dropping it reintroduces that bug.

`backfill-entries` is the one-time entries-side counterpart to
`backfill-trend`: a much deeper OpenAlex window (2 years, paged) plus a much
larger NSF batch (`rpp=2000`, confirmed the awardapi accepts up to at least
3000), merged into `entries[]` once to seed a realistic starting volume
without changing `fetch-data.ts`'s own narrow nightly windows or touching
`trend[]`. Real data only, same shared `src/lib/sources/*` modules as every
other fetch path — not fabricated volume, just a deeper pull of what already
exists. Scaling/adoption don't have an equivalent lever: the RSS feeds only
ever expose their own current retention window regardless of how far back
you ask, so `data/seed.ts` stays the only way to grow those two stages with
real, verified milestones.
