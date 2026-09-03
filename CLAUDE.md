# CLAUDE.md — context for Claude Code

This file orients a fresh Claude Code session. The project was built
collaboratively in a separate chat; this is the handoff. Read it, then the
README, then `src/lib/types.ts` (the data contract) before making changes.

## What this is

Global Tech Monitor — a pipeline view of a technology from research through
scaling, adoption, and public investment. Multi-vertical as of 2026-07-19:
Vertical 01 is quantum computing, Vertical 02 is artificial intelligence,
Vertical 03 is biotechnology and Vertical 04 is space (both added
2026-09-02 — see "Biotechnology vertical" and "Space vertical" below for
the research decisions each forced), and semiconductors is the intended
next addition — see "Multi-vertical architecture" below before adding one. It's meant as a
research instrument for a policy audience (Hoover/TFL), not a consumer
dashboard. Reference point for the design and
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
OPS CQL fragment), `fundingKeyword` (NSF Awards API keyword),
`procurementKeyword` (optional — the USASpending/SAM.gov term, falling back
to `fundingKeyword`; see "Biotechnology vertical" for the measured reason
these came apart), and `rssFeeds`/`rssClassifier` (that vertical's trade
press + keyword classifier). `src/lib/sources/{openalex,epo,nsf,rss}.ts` are tech-agnostic
machinery that take these as parameters — none of them hardcode a technology
anymore. `scripts/fetch-data.ts` loops over `VERTICALS` and writes one
`public/data/<id>.json` per vertical; `App.tsx` has a topbar tab per vertical
(a `<select>` in `.verticals`, changed from one `.vtab` button per vertical
on 2026-09-02 — the button row was fine at two and cramped at four, and
grew without bound) that switches which data file is loaded. That's the
whole mechanism; the frontend has no live-fetch path to configure per
vertical.

**Adding a vertical is real research work, not a config flag.** Each one
needs, checked by hand before it goes in `VERTICALS`:
- An OpenAlex filter that actually gets good institution-country coverage on
  a real sample (`primary_location.source.type:journal` restricted) — a
  Topic id if the field has one cohesive Topic (quantum: T10682), or an
  explicit OR'd list of hand-checked Topic ids if it doesn't. Both AI (58
  topics) and biotechnology (33) needed the list, and in both cases the
  obvious-looking Subfield was a grab-bag: OpenAlex's own "Biotechnology"
  subfield is Listeria food safety and marine sponges, and its
  best-named biotech Topic is Nature news copy. **Sample the real recent
  works of every topic you add, and record why you excluded the ones you
  excluded** — that's where the actual work is.
- A real EPO CPC classification code (or an OR'd pair, if the field spans
  more than one — AI uses `G06N3 OR G06N20`, neural networks + machine
  learning specifically, since there's no single code the way quantum has
  G06N10). Verify against USPTO/WIPO CPC definitions, not from memory.
- A funding-source keyword for the NSF Awards API — and check it against
  real returned awards, not just for a nonzero count. NSF's `keyword`
  search matches broader-impacts boilerplate, so a topic's own name is
  often the *worst* query for it (biotech: 59/300 on-topic for
  "biotechnology" vs. 300/300 for "biomanufacturing"). Check whether the
  same term also works for `usaSpending.ts`/`samGov.ts`; if it doesn't, set
  `procurementKeyword` separately rather than compromising on one.
  (A different funding API entirely is still the right answer for some
  fields — NIH grants would suit biotechnology better than NSF does, and
  that remains unbuilt.)
- Real, hand-verified RSS feeds from actively-publishing trade press (valid
  RSS 2.0, checked by curl) — see `QUANTUM_RSS_FEEDS`/`AI_RSS_FEEDS`/
  `BIOTECH_RSS_FEEDS` in `verticals.ts` for the bar. Check each feed's
  `Access-Control-Allow-Origin` header too — the Worker proxies the ones
  that don't send one. Check the `pubDate` format actually parses, too:
  Fierce Biotech's `"Sep 2, 2026 10:29am"` silently produced zero entries
  until `rss.ts`'s `parseDate` grew a fallback. And reject journal
  tables-of-contents however biotech-shaped their titles are — a paper is
  the Innovation stage's job, not a scaling milestone.
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
- Add the vertical's tickers to `src/lib/companyCategory.ts`'s
  `BY_VERTICAL`, with a `sector` value that means something for that field
  (adding new `RdSector` values is expected — "semiconductors" is
  meaningless for biotechnology). The R&D-breakdown chips derive from what
  a vertical actually uses, so an unregistered vertical silently falls back
  to "Not yet individually categorized" on every row.
- Nothing in `.github/workflows/build-and-deploy.yml` needs changing —
  checked when biotechnology was added. Both regression guards (the one in
  `fetch-data.ts` and the authoritative one in the commit step) key off "a
  previous file exists," so a brand-new `public/data/<id>.json` is written
  unconditionally on its first CI run and starts accumulating from there.

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
  hours, commits the updated data files to the `data` branch — **not
  `main`**, see "Data lives on its own branch" below — builds, and deploys
  to Pages. This keeps running — it's the only thing writing `trend[]` (and,
  since 2026-07-20, the only thing that ever pulls fresh data at all), and
  nothing below replaces it. Cadence was daily (07:00 UTC) until 2026-07-20;
  bumped to every 3 hours specifically to compensate for removing the
  browser's 3-minute live auto-refresh — see "Live data" below.
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

## Biotechnology vertical — added 2026-09-02

Vertical 03. Every number below was measured live while building it, not
recalled — re-measure before changing any of it.

**OpenAlex.** 33 hand-checked topic ids, not a subfield. OpenAlex ships a
subfield literally called "Biotechnology" (1305) whose 8 topics include
Listeria in food safety, marine sponges, and microbial inactivation
methods; "Applied Microbiology and Biotechnology" (2402) is antibiotic
resistance plus one topic on tannase. Neither is the technology. The single
most biotech-sounding topic in the whole 4,516-topic list, T14293
"Biotechnology and Related Fields", turned out on a live sample to be
Nature/Science *news copy* ("Trump administration has its sights set on
destroying international research collaborations", "India heatwave",
"Twistronics founders win 2026 Kavli Prize") with the worst
institution-country coverage of anything sampled, 7/12 — excluded for that,
not for its name. The kept list and, just as important, the 20 topics
deliberately excluded with a stated reason each, are documented inline in
`verticals.ts`. **Read that comment before adding a topic** — the excluded
ones were each checked against their real recent works and dropped for a
specific reason (food-starch science, fuel-cell fluid mechanics, veterinary
immunology, phytochemistry), and re-adding one on the strength of its name
is exactly the mistake the comment exists to prevent. Result on a live
30-day journal-only sample: 9,784 works, 50/50 with structured
institution-country data (the cleanest of any vertical here), 35 distinct
countries in that 50-work sample.

**Scope, stated once so it doesn't drift.** This vertical tracks
biotechnology as a *platform* technology — engineering biology,
biomanufacturing capacity, gene/cell therapy, omics and molecular-diagnostic
platforms, biosecurity. It is not clinical medicine and not the
pharmaceutical industry at large. That single decision is what keeps the
corpus at ~9.8k works/month instead of the millions all of biomedicine
would contribute, and it's why the RSS classifier explicitly drops clinical
readouts, licensing deals and M&A. Biofuel/biomass topics are excluded for
the same reason the CapIQ VC industry filter drops Commodity Chemicals and
Packaged Foods — consistency between the two, not squeamishness about
energy. If a future session wants industrial/energy biotech tracked, that's
a legitimate scope EXPANSION to argue for explicitly, not something to
achieve by quietly adding topics on one side.

**EPO.** `cpc=C12N OR cpc=C12Q OR cpc=C12P` — genetic engineering and cells,
nucleic-acid measurement/diagnostics, and fermentation processes. Verified
against USPTO's own CPC definitions and then run live: 642,459 results whose
newest 25 were Intellia's BCMA CAR-T compositions, Arbor Biotechnologies'
gene-editing system, circular RNA delivery, Sophia Genetics' variant
detection, UW's cell-free bioproduction. C07K (peptides) was checked and
left out — it drifts into pure peptide-synthesis organic chemistry.

**One keyword couldn't serve three sources — `procurementKeyword` exists
because of this vertical.** `fundingKeyword` had been quietly doing double
duty for NSF *and* for `usaSpending.ts`/`samGov.ts` ever since those two
were added. That works when the topical term is the same word in a grant
abstract and a contract line item ("quantum", "artificial intelligence").
For biotech it isn't, measured both ways:
- NSF with `keyword=biotechnology`: 300 returned, only 59 naming a real
  biotech technique ($35.2M of $200.8M obligated). The rest are squid
  hydrodynamics, wild-bee heat resilience and EPSCoR fellowships that
  mention biotech once as a downstream benefit. With
  `keyword=biomanufacturing`: 300 of 300 on-topic ($403.2M) — SBIR
  fermentation platforms, PURE cell-free expression benchmarking, nanopore
  QC for adenoviral gene therapy.
- USASpending and SAM.gov with "biomanufacturing": **zero results, both.**
  With "biotechnology": real ones — a $73M HHS mRNA-vaccine development
  award to Moderna, a $1.0M HHS "IPSC ENGINEERING SERVICES" contract to
  Thermo Fisher, a real DoD BAA biotechnology topic on SAM.gov.

So `fundingKeyword: "biomanufacturing"`, `procurementKeyword:
"biotechnology"`. `procurementKeyword` is optional and falls back to
`fundingKeyword`, so quantum and AI are byte-for-byte unchanged. **Don't
collapse them back into one field** — either choice alone silently zeroes
out a whole source. The disclosed cost of the NSF side is that this covers
the bioengineering/biomanufacturing *slice* of NSF's biotech portfolio
rather than all of it, which `data/biotech/notes.ts`'s investment note says
out loud.

Adding a third vertical also makes SAM.gov's daily-quota problem worse by
50% — see the long comment at the top of `samGov.ts`. Expected, not a
regression: most runs in a UTC day will 429 and soft-fail, and solicitation
postings don't change every 3 hours anyway. (Every SAM.gov call in this
session's testing returned 429, so the biotech SAM path is wired and
soft-failing correctly but has not yet returned a real record in CI.)

**Run time.** 70 tickers at `massive.ts`'s deliberate 15-second gap is
~17.5 minutes of sleeping for this vertical alone, taking a full
`fetch-data` run across all three verticals to roughly 40 minutes. Fine on
a 3-hour cron and well inside GitHub Actions' job limit, but it's the
reason a local `npm run fetch-data` now takes most of an hour — that's the
rate limit, not a hang.

**RSS — five verified feeds, and a deliberately low yield.** Fierce Biotech,
BioPharma Dive, GEN, Labiotech, Drug Discovery Trends; each curl-checked for
valid RSS 2.0, item count and date format. Six real candidates were checked
and rejected: endpts.com and genomeweb.com 403 a script, biospace.com and
synbiobeta.com have no working feed at the usual paths, and nature.com's
biotechnology subject feed and `nbt.rss` are journal tables-of-contents
(empty `<description>`, RDF in nbt's case) rather than trade press — running
research papers through a scaling/adoption classifier would file them as
manufacturing milestones.

The classifier converts ~100 fetched items into ~4 classified ones. **That
is correct, not broken.** Biotech trade press is overwhelmingly
clinical-trial readouts, licensing deals, M&A, layoffs and drug-pricing
politics — real news, none of it a production-scaling or adoption milestone
in this app's sense. The classifier's `exclude` extends
`DEFAULT_EXCLUDE_WORDS` (it doesn't replace it) with those categories
explicitly, each pattern traced to a real dropped headline. Consequence:
`data/biotech/seed.ts` carries more of the load for scaling/adoption here
than in either other vertical. Don't loosen the patterns to make the count
go up without reading the actual `rss-*` entries produced.

**A real bug this vertical surfaced in shared code.** Fierce Biotech and
Fierce Pharma emit `pubDate` as `"Sep 2, 2026 10:29am"` — no space before
the meridiem — which `new Date()` rejects outright. `parseDate` in `rss.ts`
returned `""` for it, and `fetchOneFeed` skips any item without a date, so
those feeds would have contributed exactly nothing while looking fine in the
logs. `parseDate` now retries once with a space inserted. Kept as a general
normalisation rather than a per-feed hack, since it can only touch a string
that already failed the direct parse.

**Seed data.** 68 entries (27 scaling, 31 adoption, 10 private funding
rounds) across 29 countries, spanning 1982 to 2026,
every one fetched and confirmed against its source URL — the figure, the
date and any "first" claim each read off the source rather than recalled.
Weighted toward biomanufacturing capacity in litres (Samsung Biologics'
785,000 litres across five Songdo plants, Boehringer's 185,000-litre Vienna
fermenter hall, Lonza's 330,000-litre Vacaville purchase, Grifols' plasma
fractionation in millions of litres) and toward regulatory approval as the
adoption gate, which for biotech is where national positions diverge most
(MHRA three weeks ahead of FDA on the first CRISPR medicine; India's CDSCO
approving an indigenous CAR-T at an eighth of the US price; Brazil clearing
the world's first single-dose dengue vaccine; a Philippine court
withdrawing Golden Rice from the first country that ever approved it).
Deliberately includes the vaccine-manufacturing capacity of the global
south as capacity, not as aid — Serum Institute at ~3 billion doses a year,
Bio Farma at 3.5 billion, Institut Pasteur de Dakar building toward 300
million, Afrigen's WHO technology-transfer hub, BioNTech's Kigali plant.
Still a floor rather than a finished set — quantum's seed is at 263 and
AI's at 209, so this is roughly a quarter of the mature ones. It should
grow the same way they did, one verified entry at a time.

**Backfilled 2026-09-02**, so this vertical didn't launch with one day of
history: `npm run backfill-entries -- biotechnology` took it from 1,364 to
**6,075 entries across 104 countries** (a 2-year OpenAlex window, 5,000
works fetched and 4,400 new, plus 611 NSF awards worth $555M against the
nightly run's 300), and `npm run backfill-trend -- biotechnology` gave it
7 trend points — enough for the world map's time scrubber, which needs 3.
Neither script merges `data/biotech/seed.ts`, so a freshly backfilled file
still reports the seed count from whenever `fetch-data` last ran; the next
scheduled run reconciles it.

**`backfill-trend` was writing inflated points for every vertical, and
standing this one up is what exposed it.** Fixed 2026-09-02. The script
fetched 8 pages (1,600 works) and counted a full rolling 30-day window from
them, while the nightly query fetches 3 pages (600 works) — so a
reconstructed point and a recorded point were counting to different
ceilings and were never comparable. Real shipped consequences, measured
before the fix:
- **AI**: leading backfilled points of 1,158 and 1,241 against a real
  recorded ~470 the same week. A 165% overstatement, rendering as a
  spike-then-collapse at the left edge of every AI trend chart.
- **Quantum**: 591-793 against a real ~400. Milder only because quantum's
  volume sits near the cap, still a 48-95% overstatement.
- **Biotechnology**: the artefact inverted. Because biotech publishes
  ~9,800 journal works per 30 days, a 1,600-work sample only reaches back
  a few days, so early windows were nearly empty — producing a fake ramp
  from 241 up to 1,425 and then a cliff to the real 487.

The fix is `LIVE_WINDOW_CAP` (exported from `openalex.ts`, imported by the
backfill) plus two rules: sort each reconstructed day's window
`publication_date:desc` and truncate to that cap, exactly reproducing what
a same-day fetch would have SEEN; and skip any day where the fetch neither
holds the cap's worth of works nor reaches back past the window start,
rather than writing a partial sample as a count. After the fix the three
series are coherent — biotech reads 559/564/565/566/496/488 against a real
487, quantum declines gently from 507 to a real 395.

**The trend ceiling and the fetch depth are deliberately different
numbers** — corrected 2026-09-02, hours after they were briefly conflated.
`OA_PAGES` went 3 -> 50 so `entries[]` covers the real corpus (see below),
and `LIVE_WINDOW_CAP` was raised with it, which was wrong. `trend[].counts`
is a day-over-day COMPARISON: what matters is that every point was measured
the same way, not that any point is a census. Raising its ceiling would
have orphaned every historical point and cost the deployed site **75
recorded quantum points and 51 AI points** off its time-series charts
(checked against `origin/data`, not assumed — local `public/data` was badly
stale, at 39 and 11) in exchange for nothing the `entries[]` fix hadn't
already delivered. So the trend series stays pinned at 600 and
`trendPoint()` truncates each run's now-much-larger fetch to the 600 most
recently published works before counting, reproducing exactly what a 3-page
run would have seen. Verified against the real `origin/data` files: all 75
and all 51 points still chart, and newly-stamped points chart alongside
them.

The honest caveat, always true and now written down: for AI and biotech
that series is a **fixed-size sample** of a much larger corpus, not a
census. Read its level as an index and its shape as the signal. Only
quantum's corpus is small enough for it to be a real total. `windowCap`
absent means 600 (`LEGACY_WINDOW_CAP`), not unknown — all three places that
compare ceilings normalise it that way (`loadHistory`, `backfill-trend`'s
supersede rule, and the degraded-run guard), because without that every
pre-existing production point reads as stale-ceiling and gets discarded.

**Two consequences to know.** First, a high-volume vertical can only be
backfilled as far as basic paging reaches: quantum reconstructs 30 days
(its volume is under the cap, so coverage is complete), biotech 6, AI 2,
and the script now says so on stdout instead of inventing the rest.
Second, the deployed data had the bad points until **2026-09-03, when they
were corrected on the `data` branch** — and the way that was done is worth
copying if this ever happens again. The corrected `backfill-trend` cannot
rebuild them: those dates are 46-75 days back and the script only
reconstructs the last 30 days, so a re-run would simply skip them and leave
the bad points in place. Deleting them was the obvious alternative and the
wrong one — they are real recorded observations, just counted against a
ceiling nothing else uses.

So instead they were **stamped with their real ceiling**,
`windowCap: 1600` (the buggy run fetched 8 pages x 200), which is exactly
what that field exists for: `loadHistory()` then excludes them from the
charted series automatically while every point stays in the file,
auditable. Identifying them needs no guesswork — a genuinely recorded run
always stamps `stageCounts`, so "backfilled AND unstamped" isolates the
buggy set precisely: 30 quantum points (2026-06-20 to 07-19) and 6 AI
points (2026-07-14 to 07-19). Measured effect: AI's charted series went
from 52 points ranging 2-1241 to 46 ranging 2-534, quantum's from 76
ranging 2-793 to 46 ranging 2-422. Both now start at 2026-07-20, the first
genuinely recorded run. Biotechnology had no legacy points and was
untouched.

(The remaining `2` at the low end of both ranges is the real 2026-07-21
OpenAlex-outage day, a genuine recorded observation that predates the
degraded-run guard described above. It's left alone because it's real.)

**The VC panel was wrong on day one, and that's the lesson worth keeping.**
`data/capiq/vc-funding.ts` already held a 3,916-company `biotechnology`
dataset, imported months earlier as prep work. Because `fetch-data.ts`
filters purely on `c.vertical === v.id`, it went live the instant the
vertical existed — no code change, no review. It was scoped by CapIQ's
"Biomedical Engineering" topic tag, which is *medical devices*, so the
resulting "who's getting the money in biotechnology" leaderboard was topped
by surgical robots and cardiac devices and contained a quantum company from
tag bleed. Re-imported the same day from a richer raw export using a GICS
industry filter instead — see "VC funding tracking" below for the full
story and the three importer bugs the re-import exposed. **The general
lesson: prep data that lands in the UI the moment a vertical is registered
needs to be re-read at that moment, not trusted from when it was
imported.**

Two `country` conventions this vertical forced, both written into
`data/biotech/seed.ts`'s header: a manufacturing milestone gets the country
the **capacity physically sits in**, not the parent company's domicile
(Lonza's Vacaville site is US), and a supranational body gets the country it
**physically sits in** (the European Commission is BE). Nothing is bucketed
into a synthetic "EU" code — same rule as everywhere else here.

## Space vertical — added 2026-09-02

Vertical 04. Measured live while building it; re-measure before changing
any of it.

**The scoping decision is the whole vertical.** This tracks space
TECHNOLOGY — launch, propulsion, spacecraft, satellites and their
communications, on-orbit operations, space traffic — plus the policy and
procurement around it. It does NOT track astronomy or planetary science,
which are science ABOUT space. OpenAlex's "Astronomy and Astrophysics"
subfield (3103) alone holds **2.18 million works, four times the entire
aerospace subfield**; letting it in would drown the vertical and would
also mislead, because a cosmology result is not a national space
capability. Same shape of call as excluding clinical medicine from
biotechnology.

**OpenAlex — five topics, and the rejects are the interesting part.**
Aerospace taxonomy blends space with aviation, marine and general
engineering worse than any other field here. Kept: T12042 satellite
communications (6/6 on-topic on a live sample), T11701 space satellite
systems and control (6/6), T12449 spacecraft design, T12513 rocket and
propulsion, T12717 space exploration and regulation — that last one is the
policy topic and is uniquely useful for this audience (Starlink
governance, space traffic management, satnav-spoofing liability).

Excluded with reasons, all checked against real recent works:
- **Named like space, isn't**: T14214 "Space Exploration and Technology" is
  planetary science (lunar crustal formation, Mercury's exosphere,
  meteorite spectra) — the same trap as biotechnology's T14293. T10406
  "Planetary Science and Exploration" likewise.
- **Aviation, not space**: T12125 (pilot workload, helicopter training),
  T12719 (airships, flapping-wing robots), T13855 (generic control theory,
  plus one paper on whether the upwardly mobile are left-wing).
- **Earth science USING satellites rather than building them**: T10801 and
  T11038 SAR (landslides, aquifers, tree height), T10655 GNSS (earthquake
  magnitude, ionospheric scintillation).
- **Defence/energetics**: T12699 electromagnetic launch (ceramic armour,
  battery thermal runaway), T12389 infrared targets, T13371 military
  systems.
- **Half-noise, so dropped rather than diluting**: T13200 spacecraft/
  cryogenic (submerged floating tunnels, ship anti-rolling tanks) and
  T11082 spacecraft dynamics (unmanned SURFACE vehicles, airship sizing).
  Adding both raised the 30-day count from 546 to 813 but **reduced** the
  distinct countries in a 50-work sample from 29 to 21 — the tell that the
  extra volume is concentrated noise, not coverage.

Result: 546 works in 30 days, 46/50 with structured institution-country
data, 29 countries in that sample. Comparable in size to quantum's 727.
Space technology genuinely is a smaller literature than AI or biotech.

**EPO.** `cpc=B64G OR cpc=H04B7/185`. B64G's own USPTO definition does the
aviation/space split for us — it "covers only vehicles, equipment or the
like specially adapted for cosmonautics" and explicitly excludes anything
applicable to both cosmonautics and aeronautics. Live: 25,876 results whose
newest were Viasat satellite stowage, a Blue Origin cryogenic boiler, an
Argotec microsatellite, an ArianeGroup propulsion system, a Honeybee
Robotics payload unloader. H04B7/185 adds ~2,000 satellite-comms filings.
G01S19 (GNSS receivers) was tested and rejected: it takes the total to
90,704 and the top hits become Nokia non-terrestrial-network positioning
and Google GNSS, i.e. terrestrial telecom.

**NSF is the wrong instrument here, and the vertical says so out loud.**
Measured: NSF funds space SCIENCE, not space technology. "satellite"
returns 300 awards that are almost entirely Earth scientists USING
satellite data (cloud evolution, wildfire detection, soil moisture);
"orbital" matches molecular orbitals in chemistry; "space technology"
matches 7%. `fundingKeyword: "spacecraft"` is the least-bad option and
still returns broader-impacts boilerplate. The right source is NASA
(TechPort or NSPIRES) or DoD SBIR — neither built. Consequence: this
vertical leans on procurement and the CapIQ VC panel for its money story,
and `data/space/notes.ts` states the gap rather than papering over it.

`procurementKeyword: "satellite"` is where the real public money shows up,
verified live on USASpending: Northrop's $575.3M Joint Polar Satellite
System-2 spacecraft, Rocket Lab's NASA VCLS contract, Maxar's Commercial
Satellite Data Acquisition award. "spacecraft" as a procurement term finds
JWST for Northrop but nothing for Rocket Lab or Maxar.

**RSS — six feeds and, unusually, a high yield.** SpaceNews, Payload,
NASASpaceflight, European Spaceflight, Via Satellite, SpacePolicyOnline.
The classifier converts a fetch into **18 classified items**, against
biotech's 4, and nearly all are right — Blue Canyon's spacecraft platform
and York's VLEO bus as scaling; SES awarding OHB €1 billion, LeoLabs
winning a Space Force award, ESA's Launcher Challenge contracts as
adoption. Space trade press is genuinely about milestones and contracts in
a way biotech's isn't. Four candidates were checked and left out:
space.com is consumer astronomy, arstechnica.com/space is a general-tech
outlet, teslarati.com is SpaceX fan coverage, spaceflightnow.com is largely
a launch schedule. `relevant` never matches a bare "space" — "state
space", "parameter space" and "disk space" would be constant noise in the
NSF abstracts this same regex gates.

**CapIQ VC.** Imported from `ciq_data/S&P-Space.xlsx` with
`--industry=Aerospace and Defense`: 602 companies, $25.2B disclosed, led by
Sierra Space, ICEYE, ABL Space, OneWeb, Satellogic, Terran Orbital,
Firefly, Impulse Space and Stoke, with a strong Chinese contingent
(Spacesail, Chang Guang, ExPace, Deep Blue, Interstellar Glory). The
unfiltered export is a keyword search on "space" and its 5,452 VC rows
include 948 Application Software and 288 Alternative Carriers. Known
residual noise the GICS filter can't remove: "Aerospace and Defense" also
contains supersonic aviation (Boom Technology) and air-defence
conglomerates (Almaz-Antey), so a handful of the top 25 aren't space.

**Seed data.** 36 entries across 16 countries plus one deliberately
unattributed, spanning 1957 to 2026, each verified against its source.
Expanded from 19 on 2026-09-03, which is also when the vertical got its
first `investment`-stage entries — it had none, leaving NSF grant data to
carry a stage in the one field where NSF is measurably the wrong
instrument. Now 24 scaling, 9 adoption, 3 funding rounds (Sierra Space's
$1.4B Series A, Skyroot at a $1.1B valuation as India's first
space-technology unicorn, ICEYE's €450M primary Series F above a €10B
valuation).

Eleven of the additions are historical anchors, because the set opened at
2015 and so could not show a decade of anything in a field with six of
them — Sputnik 1, Vostok 1, Astérix, Apollo 11, Ohsumi, Dong Fang Hong 1,
Ariane L01, Rohini RS-1, STS-1, Ofek 1 and ISS Zarya. That sequence is
also the cleanest available answer to "which countries can reach orbit on
their own rocket, and when could they first do it," which is the question
this vertical exists to support. Still a floor, not a finished set —
quantum is at 263.

Two conventions this vertical forced, both in the seed header. First,
attribution goes to **whatever the milestone is about**, because launch
sites are routinely in a different country from whoever built the vehicle:
Isar Aerospace's Spectrum is DE even though it flew from Andøya in Norway
(the milestone is a German company's launch capability), while Rocket
Lab's first orbital flight is NZ and SaxaVord's licence is GB because in
those two the milestone IS the site. Second, **failed attempts belong in
the set** — two of the launch entries are failures, stated as such, because
a seed set of only successes would misrepresent how hard orbital launch is
and a country's first attempt is the real milestone either way.

## Seed history: the sets were recency-biased, and partly still are

All three seed sets were built by researching what's happening now, which
produced a real and measurable skew. Measured 2026-09-02 before fixing:
quantum had 1 entry in 2016, 5 in 2017, and 70 in 2025; AI had exactly one
pre-2019 entry; biotech started in 2018. The pipeline view therefore opened
mid-story, and none of the three could show a decade of anything.

Historical anchors added, each verified the same way as any other seed
entry — the events every later entry is implicitly measured against:
- **quantum** back to 2011: Lockheed Martin buying D-Wave One (the first
  commercial quantum computer sale, ~$10M), the UK's £270M National Quantum
  Technologies Programme in the 2013 Autumn Statement, and China's Micius
  satellite launch.
- **AI** back to 2011: Watson winning Jeopardy!, AlphaGo beating Lee Sedol,
  Google revealing TPU v1 (already a year old in its own data centres), and
  Canada's Pan-Canadian AI Strategy — the world's first national AI
  strategy, which the set was missing entirely.
- **biotech** back to 1982: Humulin's approval, the first marketed product
  of any kind from recombinant DNA, and Kymriah in 2017, the first CAR-T
  and the first gene therapy cleared in the US.
- **space** back to 1957 (added 2026-09-03, a month after the vertical
  itself): the eleven anchors listed under "Space vertical" above. This
  vertical had the worst version of the problem — it opened at 2015, and a
  space tracker that starts at 2015 silently asserts that the first
  fifty-eight years of spaceflight don't bear on who leads now. Russia was
  absent from the set entirely before this, which for this field is not a
  gap but an error.

**The skew is reduced, not gone.** The middle years are still thin —
quantum has single-digit entries per year before 2019, AI nothing between
2017 and 2019, space nothing between 1998 and 2015 — and the fix for that
is the same slow, additive, verify-every-claim work, not a bulk import. When adding entries, check the
year distribution rather than only the country list; it's the easier gap to
miss because recency bias in a research pass feels like thoroughness.

## Talent vertical — archived 2026-07-25

A `talent` (STEM workforce / human capital) vertical was added 2026-07-24
and removed 2026-07-25 as not fitting this app's scope — it needed more
workarounds than any other vertical to satisfy the pipeline's own shape:
an empty `openAlexFilter` (no coherent OpenAlex research corpus for "human
capital"/"STEM talent" — checked by hand, only 16/25 sampled works even had
institution data, most off-topic) with OECD researcher-headcount statistics
substituted in for the Innovation stage instead of papers, an empty
`epoCpcQuery` (no real CPC code maps onto the STEM workforce pipeline), a
CFDA-code NSF query instead of a free-text keyword (a "STEM workforce"
keyword matched 281/300 sampled NSF awards, since nearly every grant's
boilerplate mentions training students), and no ticker list at all (no
real public company maps onto "STEM talent" as an investable entity). Each
workaround was individually defensible but together they made talent read
as a different *kind* of thing than quantum/AI, not just a third instance
of the same kind.

Its full code — the `VerticalConfig` entry, RSS feeds/classifier,
`data/talent/{seed,notes}.ts`, and `src/lib/sources/oecd.ts` (the OECD
SDMX-API fetch this vertical was the only caller of) — is preserved in
full on the git branch `archive/talent-vertical`, cut from the commit
immediately before removal. Restorable in one piece if this vertical is
worth rebuilding with a different approach later (e.g. a real per-country
weighted-count aggregate before leaning on OECD stats again — the old
implementation had an unresolved "known tension" where `countByCountry`'s
entry-count convention read as researcher-magnitude when it was really
counting years of OECD data on file, a real bug worth fixing before this
comes back, not just re-shipping as-is).

## Public markets panel (Massive) — not part of the 4-stage pipeline

Added 2026-07-24. Each `VerticalConfig` carries a `tickers: string[]` — a
hand-picked list of real, publicly-traded companies materially exposed to
that vertical. Started at 6 per vertical, broadened the same day to 26
(quantum) and 47 (AI) via a real research pass per vertical (see
`verticals.ts`'s own comments for the category breakdown — pure-plays,
large incumbents, defense contractors with documented programs,
fab-equipment makers, etc.) — every candidate ticker was then confirmed
live against Massive's own reference endpoint before being kept; 2 didn't
resolve at all (Toshiba's `TOSYY`, Quantum eMotion's `QNCCF`) and 14 more
resolved but carry no market-cap data on this plan tier (mostly foreign
OTC ADRs — Samsung, SoftBank, Tencent, NTT, Fujitsu, BAE Systems, Airbus,
Thales, Mitsubishi Electric, NEC, Archer Materials) — all excluded rather
than shown as empty rows. `CompanyMarketPanel.tsx` renders this as a
scrollable table (reusing the `.lb` leaderboard table styling), not cards
— a 20-50 row list needs a dense, scannable shape, not a wrapped card grid.

**Known tension, not yet resolved**: past the handful of pure-plays
(IonQ/Rigetti/D-Wave/Quantum Computing Inc./Arqit/SEALSQ for quantum),
most of these tickers are large diversified companies (Lockheed Martin,
IBM, Adobe, chip-fab-equipment makers) whose total SEC-EDGAR R&D spend
(`secEdgar.ts`, feeding `RdSpendTrend.tsx`) is NOT specifically quantum or
AI R&D — it's their whole company's R&D budget, of which the vertical in
question is one line among many. Broadening the ticker list from 6 to
26/47 made this tension worse, not better: the "Private investment over
time" chart now reads more like "total R&D of companies with some
exposure to this vertical" than "R&D spent on this vertical" specifically.
Flagged here rather than silently worked around — a real fix would need a
per-company weighting or a pure-play-only mode, not yet built.

`scripts/fetch-data.ts` fetches each
ticker's market cap and today's price move via the Massive REST API
(`src/lib/sources/massive.ts`, `api.massive.com` — confirmed by hand against
the real docs before writing this, not guessed: `GET
/v3/reference/tickers/{ticker}` for market cap/name/homepage,
`GET /v2/snapshot/locale/us/markets/stocks/tickers/{ticker}` for price/day
change, auth via `?apiKey=` or `Authorization: Bearer`), and stores the
result in `DataFile.companies` — a new top-level field, deliberately NOT an
`Entry`. A stock price is a standing fact about a company, not a dated
research/scaling/adoption/investment event, so it renders as its own panel
(`CompanyMarketPanel.tsx`, right below the KPI row) rather than living
inside a pipeline stage or being forced into the `Entry` shape. Needs
`MASSIVE_KEY` (repo secret + `.env.local`, same pattern as `EPO_KEY`) —
soft-fails like every other source here if unset, and on a transient
failure `fetch-data.ts` carries the previous run's snapshot forward rather
than blanking the panel (a stale market cap is still real, just not today's).
No red/green color for the day's move, only a +/- sign — this app's color
budget is the Hoover accent and country hues only (see "Design system"
below), don't add a third semantic color use here.

`fetchCompanySnapshots` fetches tickers one at a time with a 15-second gap
between them, not all in parallel — confirmed by hand that firing a
vertical's whole ticker list at once trips a 429 partway through on a
5-calls/minute-shaped plan tier. It also only overwrites the carried-
forward snapshot when at least one ticker actually succeeded (or the
vertical has no tickers at all) — an all-failed batch used to silently
blank a good prior snapshot instead of falling back to it. Separately, the
snapshot (price/change) endpoint can return `403 NOT_AUTHORIZED` on a plan
tier that only covers reference data (`ticker-overview`) — that's now
logged explicitly rather than silently swallowed; market cap still comes
through fine from the overview call either way.

## Public vs. private investment over time

Added 2026-07-24. Two real trend charts sit below "Funding by country,"
deliberately kept as separate signals rather than merged into one number:

- **Public investment** (`FundingTrend.tsx`) reads the NSF-based
  `trend[].fundingUsd` that's been recording once per day since
  2026-07-20 (see "Data lives on its own branch" — this field existed
  before but had no chart of its own until now). Same US/EU-only caveat as
  everywhere else this app touches NSF.
- **Private investment** (`RdSpendTrend.tsx`, `DataFile.rdSpend`) is real
  disclosed corporate R&D spend, summed across a vertical's `tickers`,
  sourced from SEC EDGAR's XBRL API (`src/lib/sources/secEdgar.ts`,
  `data.sec.gov` — free, no key, confirmed by hand: Nvidia's real R&D went
  $8.68B → $12.91B → $18.50B FY2024-26). Unlike the NSF chart, full
  multi-year history arrives on the very first successful fetch — no
  daily accumulation needed, since SEC's API already returns a company's
  whole filing history in one call.

**`fetchRdSpendByYear` was asking SEC for one concept in one taxonomy, and
losing most of its available data to that** (fixed 2026-09-02). SEC hosts
both `us-gaap` and `ifrs-full`, and companies tag R&D under several
different concepts. Amgen returning HTTP 404 on
`us-gaap:ResearchAndDevelopmentExpense` while reporting R&D in every annual
report is what gave it away. Audited all 38 tickers across the three
verticals that were coming back empty: **30 had usable SEC data under a
concept the fetcher never asked for.**
- `us-gaap:...ExcludingAcquiredInProcessCost` — Amgen (51 annual facts back
  to 2007), Pfizer, AbbVie, Zoetis, Qiagen, 10x Genomics, Teradyne
- `us-gaap:...SoftwareExcludingAcquiredInProcessCost` — Adobe
- `ifrs-full:ResearchAndDevelopmentExpense` — the 20-F filers, i.e.
  AstraZeneca, Novartis, Legend Biotech, SOPHiA, Bioceres, BioNTech,
  Sanofi, GSK, Novo Nordisk, Takeda, SAP, TSMC, Nokia, SK Telecom

Now tries all four in order, accepts 20-F alongside 10-K (a foreign private
issuer's annual report is exactly what the ifrs concept is for), and takes
the first concept with usable facts. Verified live: 15 previously-empty
tickers returned $60.7 billion of real FY2025 R&D — Amgen $7.27B, Pfizer
$10.44B, AbbVie $9.10B, AstraZeneca $14.23B, Novartis $11.20B, Adobe
$4.29B.

**USD only, deliberately.** `RdSpendPoint.totalUsd` is a sum across
companies, so folding an unconverted EUR or JPY figure in would make it
simply wrong rather than imprecise, and converting properly needs
historical FX at each fiscal-year end — a source this app doesn't have.
A filer reporting only in its own currency is skipped with a message
saying which problem it is, so it doesn't read as "reports nothing". That
leaves ten real companies (BioNTech in EUR, Sanofi EUR, GSK GBP, Novo
Nordisk DKK, Takeda JPY, SAP EUR, TSMC TWD, ASML EUR, Nokia EUR, SK
Telecom KRW) which **a CapIQ export is the right fix for**, since
`IQ_RD_EXP_FN` comes back already in USD. Eight more (NAUT, CRL, RNA,
AMZN, INOD, ARQQ, LHX, BAH) have nothing at SEC under any concept — Amazon
for the documented reason below, the rest apparently not tagging a
standalone line at all.

Two things `fetchRdSpendByYear` handles that would otherwise silently
misrepresent the number: (1) a company that doesn't tag a standalone
`ResearchAndDevelopmentExpense` XBRL concept — Amazon folds R&D into a
broader "technology and infrastructure" line that mixes in non-R&D costs —
is skipped entirely rather than force-fit with a mismatched figure; (2) a
trailing fiscal year where not every already-covered company has filed yet
(a company with a January fiscal-year-end, like Nvidia, reports "FY2026"
while calendar-year-end peers are still on "FY2025") is trimmed from the
end of the series rather than shown as a total that looks like spending
collapsed. This only trims the *tail* — earlier years legitimately having
fewer companies (IonQ/Rigetti/D-Wave didn't exist as public filers before
2021-2022) are real history and are kept as-is.

Never merge `rdSpend`'s totals into `fundingByCountry`/the Investment
stage's `amountUsd` aggregate — `STAGES` defines Investment as "public
research funding, where governments are placing money," and corporate R&D
is a different, private thing. Keep the two charted side by side, not
summed into one misleading "total investment" figure.

## Foreign R&D spend (S&P Capital IQ) — a second, manual source for rdSpend

Added 2026-07-25. 11 real, verified companies across both verticals'
ticker lists (Samsung, SoftBank, Tencent, NTT, Fujitsu, Mitsubishi
Electric, NEC, BAE Systems, Airbus, Thales, Archer Materials) are foreign
20-F filers — SEC EDGAR's XBRL API structurally can't reach them (see
"Public markets panel," they resolve on Massive's reference endpoint but
carry no market-cap data either). Stanford's S&P Capital IQ Pro access
covers exactly this gap: real R&D expense (`IQ_RD_EXP_FN` field), verified
by hand against a live export (2026-07-24 — Samsung's real ~$26-28B/year
figure matched the raw cell value read as thousands of USD).

This is **manual, not automated** — Capital IQ's Excel plugin is
Windows-only (a COM add-in), so there's no key or endpoint to call on a
schedule from a Mac. The real workflow: export a Companies-screener report
from the CapIQ Pro web app (`Screener Home → Companies`, add the target
companies via "Add Companies," add the `IQ_RD_EXP_FN` display column,
`Run Screen`, export to Excel), then run `npm run import-capiq-rd-export
-- <path-to-xlsx>`, which parses the real export (`scripts/import-capiq-
rd-export.ts`, using `adm-zip`+`fast-xml-parser` to read the raw XML
inside the .xlsx, not a new heavy Excel-parsing dependency) and writes the
derived figures to the committed `data/capiq/rd-spend.ts`. **Never commit
the raw .xlsx** — S&P's data licensing doesn't permit redistributing raw
platform exports, unlike the free public sources (SEC/NSF/OECD) this repo
otherwise commits; `.gitignore`'s `SPGlobal_Export_*.xlsx` pattern exists
specifically to catch this. Re-run the import after a fresh export if this
data goes stale — there's no automated freshness check the way live
sources get one via `sourceMeta.ts`'s `lastSuccessfulPull`.

`fetch-data.ts`'s `mergeCapiqRdSpend` layers `CAPIQ_RD_SPEND` (filtered by
`CAPIQ_TICKERS_BY_VERTICAL`, a small hand-maintained map — deliberately
NOT reusing `verticals.ts`'s `tickers`, since these companies are
correctly excluded from the market panel but still relevant to R&D spend)
onto SEC EDGAR's already fiscal-year-trimmed `rdSpend` array, additively
per year. Each company entry in `RdSpendPoint.companies` now carries a
`source: "sec" | "capiq"` tag for exactly this kind of provenance
auditing — `RdSpendTrend.tsx`'s tooltip surfaces the CapIQ count when
nonzero rather than presenting a blended figure as if it were one
uniform, live-fetched number.

**Re-imported and expanded 2026-09-02** from a fresh export, which surfaced
four things worth keeping:

- **The export is a name search, not a ticker screen.** 5,531 rows, of
  which only **106** carry a CapIQ exchange code — the rest are
  subsidiaries and long-acquired entities (Samsung Display, Shire, Baxalta,
  L3 Technologies, ASML US LLC, even Fun City Popcorn Inc.). The importer
  only accepts rows whose name ends in a mappable `(EXCHANGE:TICKER)`, and
  now logs unlisted rows as a single count rather than 5,425 warnings that
  drown the real signal. **Only warn on listed companies** — an unmapped
  listed company is a decision someone has to make; an unlisted subsidiary
  is expected noise.
- **Ticker-suffix collisions are real and would have been silent.**
  `ASX:SKM` in this export is *Skylark Minerals Limited*, an Australian
  minerals company — this app's `SKM` is SK Telecom, in quantum's list for
  quantum networking. `TSE:7240` is *NOK Corporation*, a Japanese
  sealing-parts maker — this app's `NOK` is Nokia. Both are recorded in
  `KNOWN_COLLISIONS_DO_NOT_MAP` so nobody helpfully adds them later. **A
  matching suffix is not a matching company.**
- **Three real companies carry no usable figure and are excluded rather
  than mapped**, also in that list: Booz Allen (0 non-NA years — a
  consulting firm has no R&D line at SEC or CapIQ, a genuine dead end),
  Arqit (0 years), and Charles River, whose only data is FY1996/1998/1999
  at $1.5M/$1.4M/$0.5M — a pre-IPO stub two orders of magnitude below the
  modern company, which would have dropped three ~$1M rows into
  late-1990s years where this app has almost nothing else. Amazon is
  excluded for the reason already documented: CapIQ reports $108.5B for
  FY2025, the same blended "technology and infrastructure" line SEC
  exposes.
- **The merge now dedupes against SEC, and this became load-bearing the
  same day.** Before `secEdgar.ts` learned to try multiple XBRL concepts
  and taxonomies, the CapIQ list and the SEC-covered list happened not to
  overlap and the merge added unconditionally. They overlap now — Alibaba,
  Baidu, Nebius, SAP and TSMC each publish a *partial* USD series at SEC
  alongside their home-currency one — and 49 AI figures would have been
  counted twice, once per source. SEC takes precedence (free, live,
  machine-readable); CapIQ fills gaps.

**The tail-trim now runs again AFTER the merge**, which reverses an earlier
deliberate decision. CapIQ's export always carries the newest fiscal year,
so it re-created whatever trailing year SEC's own trim had just dropped,
populated by only the handful of companies CapIQ covers. Measured on real
AI data: SEC trimmed to FY2024 at 43 companies, then CapIQ re-added FY2025
with 10 companies and $73.7B against FY2024's much larger total — an
apparent 75% collapse in the latest year that is purely a coverage
artefact, i.e. exactly what the trim exists to prevent. Re-creating that
bucket was defensible when CapIQ contributed 3 tickers and rarely won the
tail; it isn't now. After the fix AI ends at FY2024 with 49 companies and
$281.8B, biotech at FY2025 with 62 companies and $121.8B.

`CAPIQ_TICKERS_BY_VERTICAL` now holds two kinds of entry: the original
foreign 20-F filers with no Massive market cap (so not in `tickers` at
all), plus companies that ARE in a vertical's `tickers` but that SEC can't
give a USD figure for — either they report only in their home currency
(ASML EUR, GSK GBP, Takeda JPY, BioNTech EUR) or tag no standalone R&D
concept (L3Harris, Innodata, Nautilus, Atrium). Still uncovered and worth
a future export: **Sanofi and Novo Nordisk**, both non-USD at SEC and
absent from this export.

## VC funding tracking (S&P Capital IQ Transactions) — a second, much deeper source

Added 2026-07-25. Same access as the R&D-spend import (Stanford's S&P
Capital IQ Pro, web app + bulk export — confirmed by hand, checking the
platform's own full nav, that there is no SQL console, API, or developer
section anywhere in this account's access; a SQL-looking snippet floated
mid-session turned out not to be runnable against anything, it was
reference material, not a live connection). Different screener from the
R&D pull, though: **Transactions**, not Companies.

`data/capiq/vc-funding.ts` is real, current data for `artificial-
intelligence` (21,484 companies, 5-year history 2021-2026, merged from
both an "Artificial Intelligence"-tagged and a "Machine Learning"-tagged
export — see dedup below), `quantum-computing` (101 companies — see the
topic-tag story below), `biotechnology` (1,848 companies, $83.4B disclosed, 2026-09-02 — a full
re-import that REPLACED the original 3,916-company set, which was
mis-scoped; see the topic-tag story below, it's the most useful cautionary
tale in this file), plus **prep data for one vertical that still doesn't
exist in the app**, `defense-tech` (999 companies) — imported at the user's
request as groundwork for a future full vertical, not wired into
`VERTICALS`/rendered anywhere yet.

Nothing in `fetch-data.ts` had to change to render any of this per
vertical — it filters on `c.vertical === v.id`, so a vertical whose id
matches an already-imported key picks the data up for free. That's how
biotechnology's rows went live the moment the vertical existed, which is
also exactly how a mis-scoped import reaches the UI without anyone
re-reading it.

Five real problems this data has that the import (`scripts/import-capiq-
transactions.ts`) has to handle, not paper over:

- **Mixed transaction types.** Every export includes M&A, stock buybacks,
  debt issuance (`DCM - *`), and follow-on public offerings (`ECM - *`)
  alongside real financing rounds. `VC_TYPE_PREFIXES` (`ROF - Venture -`,
  `ROF - Early Stage -`, `ROF - Mature -`) is the filter isolating genuine
  VC/growth rounds from the rest.
- **Entity fragmentation, mostly solved by a real ID field.** A first AI
  export had no entity-ID column at all — OpenAI showed up as three
  separate legal-entity names (`OpenAI, L.L.C.`, `OpenAI OpCo, LLC`, `The
  OpenAI Deployment Company, LLC`) with nothing to join on, handled via
  `entityResolution.ts`'s `canonicalizeOrg()` (a fixed `LEGAL_SUFFIX`
  regex that didn't handle "L.L.C." with periods, plus a hand-verified
  alias for OpenAI's variants). A later 5-year re-export added a real
  `SPTR_TARGET_ID` field, confirmed to correctly merge those same three
  names onto one id — the importer now prefers that id when present,
  falling back to the name-heuristic only when it's absent (quantum's
  export, for one, has the id but not `SPTR_ANN_DATE` at all — confirmed
  by hand; not every export includes every optional column). Even the
  real id isn't perfectly clean — Quantinuum still splits across two ids
  in the current data, a known minor gap, not a crash.
- **CapIQ has no "Quantum Computing" or "Biotechnology" topic tag —
  confirmed directly by the user checking the platform.** Quantum's real
  tag options are only "Encryption" and "Post-Quantum Cryptography";
  "Encryption" alone swept in mainstream cybersecurity companies with zero
  quantum relevance (Netskope, Lookout, Crypto.com topped the leaderboard
  purely for that tag) while every actual quantum computing company
  (PsiQuantum, IQM, Pasqal, Xanadu, Atom Computing, Rigetti, Multiverse)
  was entirely absent. Fixed by filtering to rows also tagged
  specifically "Post-Quantum Cryptography" (the `requireTag` CLI arg) —
  the resulting 101 companies (Quantinuum, QuEra, Alice & Bob, IonQ,
  Classiq, ID Quantique, Zapata...) are genuinely quantum-adjacent.
  "Biotech" had the same problem worse: the export actually covered five
  tags (`Biomedical Engineering`, `Bio-based and Renewable Materials`,
  `Biomass Energy`, `Biofuel`, `Biometrics`) from what was clearly a
  keyword search on "Bio" — the unfiltered result was topped by water
  utilities and Chinese renewable-energy companies. It was filtered to
  `requireTag: "Biomedical Engineering"` only, and **that turned out to
  still be wrong, caught 2026-09-02 when the biotechnology vertical went
  live and this data got rendered for the first time.** "Biomedical
  Engineering" is medical devices. The resulting "who's getting the money
  in biotechnology" table was topped by Verily Health, BVI Medical (ophthalmic
  surgical devices), BrainCo (BCI wearables), Impulse Dynamics and Kardium
  (cardiac devices), CMR Surgical and Distalmotion (surgical robots) — and
  contained a *quantum* company, Shanghai TuringQ, from pure tag bleed.
  Not one of the top 30 was a biotechnology company.
  **Don't trust an export's topic-tag scoping just because the filename
  matches the vertical you asked for — check the real tag breakdown by hand
  before importing, and then check the top of the resulting leaderboard
  reads like the field you meant.** The tag histogram passing isn't
  sufficient; "Biomedical Engineering" was a real tag that really was
  bio-adjacent and still produced a table about something else.

  Re-imported 2026-09-02 from `ciq_data/S&P-Biotechandsyntheticbio.xlsx`
  (a much richer raw Transactions export already sitting in `ciq_data/`,
  which the original import didn't use) with a **GICS industry filter
  instead of a topic tag** — `--industry=Biotechnology,Life Sciences Tools
  and Services,Pharmaceuticals`, matched against
  `SPTR_IQ_TARGET_PRIMARY_INDUSTRY`. That export carries no Topic Tags
  column at all but does carry CapIQ's own industry classification of the
  target, which is a strictly stronger scoping signal: it classifies the
  company rather than keyword-matching it. Of 5,024 VC rows, 3,447 are
  GICS "Biotechnology" alone; the filter keeps 4,207 and drops Health Care
  Technology/Equipment/Services, Packaged Foods, Commodity Chemicals and
  Application Software (each logged on every run, so a too-narrow filter is
  visible). Result: 1,848 real biotech companies, $83.4B disclosed, topped
  by Ceva Santé Animale, EQRx, Roivant, Samsung Biologics, Moderna, CureVac,
  Sana, Ginkgo Bioworks, National Resilience, Generate Biomedicines. **Prefer
  `--industry` over `requireTag` whenever an export has the industry
  column.**
- **Deal-level double-counting across multiple tag searches.** Merging
  Machine Learning into the existing `artificial-intelligence` data is
  the case that forced this: the two tag searches share enormous real
  overlap (of 31,206 ML-tagged VC rows, 30,459 were already present from
  the AI-tagged export). `VcDeal.dealId` (CapIQ's own
  `SPTR_MI_TRANSACTION_ID`) is the real dedup key — the importer's merge
  step adds a fresh export's deals into whatever a vertical already has,
  skipping any `dealId` already seen, rather than either replacing the
  vertical's data outright or blindly re-summing potentially-duplicate
  rows. A `--replace` flag exists for the other case, added 2026-09-02:
  when a PRIOR import was mis-scoped rather than merely incomplete, the
  default merge would keep the bad rows forever.
- **Three real importer bugs the richer biotech export exposed** (all
  fixed 2026-09-02; all latent the whole time, just never triggered by the
  narrower AI/quantum exports):
  1. **Investor columns were inferred as "every column not otherwise
     claimed."** That held when the only unclaimed columns *were* the
     investor ones. The biotech export also carries
     `SPTR_IQ_TARGET_PRIMARY_INDUSTRY`, `SPTR_TARGET_COUNTRY`,
     `SPTR_TARGET_BUSINESS_DESCRIPTION`, `SPTR_IMPLIED_EV`,
     `SPTR_CURRENCY_CODE`, `SPTR_ROUND_TYPE`, `SPTR_ADVISER_NAME`/`_ROLE`
     and `SPTR_DEAL_SUMMARY` — so real deals came out with
     `investors: ["NA", "EUR", "Mature", "Adviser Role: ..."]`. Now read
     from the super-header's own `Buyers/Investors Name` label, with the
     old heuristic kept only as a fallback and which path was taken logged
     on every run.
  2. **Generated-file escaping only handled double quotes.** One investor
     cell containing a literal newline produced an unterminated string
     literal in `data/capiq/vc-funding.ts` — a hard build break, not a
     data smell. All emitted strings now go through one `tsLit()` helper
     that escapes backslashes first, then quotes, then collapses
     whitespace. Side effect worth knowing when reading that commit's
     diff: regenerating the file also ran the carried-over quantum/AI/
     defense-tech rows through `tsLit()`, which collapsed double spaces
     inside 7 of 21,484 AI investor names (a stray double space in
     "Korea Biotech Investment Capital", "EEC Ventures Sp. z o.o." and
     five others). Verified by diffing every row against `HEAD` — all
     amounts, deal counts and deal ids identical, and the normalisation
     helps entity resolution rather than hurting it.
  3. **`excelDateToIso` mapped an empty date cell to Excel's own epoch**,
     putting 99 deals in the data dated `1899-12-30`. Serial `<= 0` now
     returns null and stores `""` like any other missing date. Guarded on
     the actual failure (an empty cell) rather than on an implausible
     year — this export does carry real financing rounds back to 1980.

Rendered as `VcFundingLeaderboard.tsx`, a real entity-consolidated "who's
getting the money" table (top 25 by disclosed total raised, click a row
to expand its individual rounds) — deliberately separate from the
hand-curated `funding-round` seed Entries elsewhere in this doc, which
stay as the small, individually-verified set that shows up in the
pipeline/map/EntryModal. The CapIQ data is far larger and real, but
entity-resolved by heuristic/id rather than hand-verified line by line, so
it gets its own panel rather than being merged into the same Entry-shaped
list.

`VC_FUNDING_CAP` (`fetch-data.ts`, currently 200) caps what actually lands
in the browser-facing `public/data/<id>.json` — the real, full,
entity-consolidated dataset (tens of thousands of companies once biotech/
defense-tech are this deep) lives in the committed `data/capiq/vc-
funding.ts` regardless, since `VcFundingLeaderboard.tsx` only ever renders
a top-25 table anyway. Don't remove this cap without reconsidering payload
size — an uncapped AI export alone generated an 8.9MB source file.

**PitchBook has no biotechnology coverage yet, and it is blocked on WRDS
support — not on the code, and not on the password.**
`data/pitchbook/vc-funding.ts` carries quantum and AI, so biotechnology is
the one vertical with a single VC provider where the others have two.
Adding it needs a real PitchBook vertical-tag or keyword query checked live
against WRDS first — their taxonomy has no plain "Biotechnology" vertical
any more than it has a quantum one, so it's a research step, not a config
line, and a guessed value must not be committed.

Attempted 2026-09-02. The server rejects the connection with `FATAL: PAM
authentication failed for user "ejohnston"` (SQLSTATE 28000), confirmed by
completing the Postgres startup handshake by hand — TCP connects in 0.1s
and SSL negotiates, so it is not the network. **The obvious read is a stale
password and that read is wrong: the credential is correct.** WRDS
authenticates Postgres through PAM, PAM consults Duo, and this account's
Duo enrolment is disabled — the web login returns "Your Duo account is
disabled and cannot access this application." A disabled MFA account fails
PAM identically to a bad password, so the two are indistinguishable from
the client side, and re-entering the credential cannot help.

**Don't spend time on the password.** Clearing it needs a WRDS support
request (wrds-www.wharton.upenn.edu/contact-support/, quoting the
institution email on the account). Once access is back, probe
`vc_glb_companyverticalrelation` / `vc_glb_companyindustryrelation` for the
real bio-adjacent values before adding a `VERTICAL_QUERIES` entry.
`import-pitchbook.ts`'s error handler now leads with the disabled-account
case instead of sending the next person to reset a working password —
that's a correction to advice this file gave earlier the same day.

**Known gap, not yet resolved**: even the AI/ML data's 5-year span is
recent-heavy by construction (most VC activity in any dataset skews to
the last 1-2 years) — real multi-year forecasting on top of this is still
a separate, not-yet-built piece of work.

## Private funding rounds — a third `SourceKind` in the Investment stage

Added 2026-07-24. There's no free, reliable API for this (Crunchbase's full
API needs a paid Enterprise/Applications license, no free tier; SEC Form D
filings are real and free but too noisy — searching "Anthropic" turns up
109 hits, nearly all secondary-market SPVs referencing the name rather than
Anthropic's own primary rounds). So this is hand-curated, same pattern as
`data/<vertical>/seed.ts`'s scaling/adoption milestones: real private
capital raises, `source: "funding-round"`, `stage: "investment"`,
individually verified against the announcement before being added (15
quantum rounds, 17 AI rounds, built via two parallel research passes then
spot-checked by hand against three of the largest/most surprising figures —
Anthropic's Series H, OpenAI's round, PsiQuantum's Series E — before
trusting the rest). Excludes already-public companies in each vertical's
`tickers` list — their capital story is the public-markets panel and the
R&D-spend chart instead, not a seeded entry here.

**This is why `fundingByCountry` and `periodFunding` in `aggregate.ts` now
filter to `source === "grant"` explicitly, not just `stage === "investment"`
— they used to assume the stage was NSF-only by construction.** Without
that filter, a single Anthropic round would swamp the "Disclosed
investment" KPI, the "Funding by country" bar chart, and the "Public
investment over time" trend line, all three of which are specifically
supposed to read as the NSF/public number (confirmed the failure mode is
real before shipping the fix: AI's actual data had $267B of private rounds
against $230M of real NSF grants — a 1000x distortion if merged).
`AwardSizeHistogram` already filtered to `source === "grant"` before this
change and needed no fix. Funding-round entries still show up everywhere
else Entry-shaped data normally does — RecentEntries, the map, the
Investment stage's pipeline column (with its own "Funding round" filter
chip in `StageColumn.tsx`), EntryModal drill-down — since browsing them
individually is exactly the point; only the dollar *aggregates* need the
NSF-only guard.

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

## Data lives on its own branch, not `main`

Changed 2026-07-20. `public/data/*.json` used to be committed straight to
`main` by every fetch run — daily, then every 3 hours once the cadence was
bumped (see "Live data" below) — which meant `origin/main` moved out from
under anyone working locally that often, forcing a `git pull`/rebase before
every push even though the bot's commits and a human's commits almost never
touch the same lines. That's the actual complaint that triggered this: it
kept happening in practice, including once mid-session while writing this
file. Fix: `public/data/*.json` is now **gitignored on `main`** and lives
on a dedicated `data` branch that only the fetch workflow ever touches.

Mechanically, in `build-and-deploy.yml`:
1. **Seed public/data/ from the data branch** — before `fetch-data.ts` runs,
   because `readPrevious()` needs a real prior file on disk to accumulate
   `trend[]`/`entries[]` against, and `main`'s checkout won't have one
   (gitignored). Uses `git archive origin/data -- public/data | tar -x` —
   writes the files to disk without touching git's index, so nothing here
   risks staging a change against `main`.
2. **Fetch data** — unchanged, writes to `public/data/` on disk exactly like
   before.
3. **Commit updated data to the data branch (not main)** — the job's own
   checkout stays on `main` the entire time; a *separate* git worktree
   pointed at `origin/data` receives the commit and push. The build step
   right after still reads `public/data/` from the main checkout's working
   directory (untouched by the worktree operation), so nothing about the
   actual build changed.

**Consequence for local dev**: a fresh `git clone` of `main` has no
`public/data/*.json` at all — `public/data/` is empty until you either (a)
`git fetch origin data && git archive origin/data -- public/data | tar -x`
(same one-liner the workflow uses) to pull down the real accumulated
history, or (b) run `npm run fetch-data` yourself, which works but starts
`trend[]` from zero since there's no prior file to accumulate against
locally. Don't try to "fix" this by un-gitignoring the files or pointing
`readPrevious()` at `main` again — that reintroduces the exact problem this
section exists to prevent.

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

**EPO_KEY / EPO_SECRET went unset as GitHub Actions secrets for 45 days,
so patents were never once fetched in CI until 2026-09-03.** Fixed that
day. Recorded here because the shape of the miss is worth remembering, not
because anything is still broken.

The bug: this section previously claimed the secrets were added
2026-07-19. They were added to the *Worker* (via wrangler) and never to
Actions. `build-and-deploy.yml`'s `env:` block was correct the whole time
and did pass all five keys through — the secrets simply didn't exist, so
every run logged `patents skipped: EPO key/secret not set`, once per
vertical, and stayed green. Note this is the mirror image of the failure
the section below warns about (secrets stored but not passed through),
which is exactly why that warning didn't catch it. **When a soft-failing
source stops growing, check whether the credential exists before checking
whether it's wired.**

State before the fix, measured on `origin/data` at commit `a7ea39e`:

| vertical | patents | ingestedAt | EPO lastSuccessfulPull |
|---|---|---|---|
| quantum-computing | 100 | all `2026-07-20` | `2026-07-20T18:13:30Z` |
| artificial-intelligence | 100 | all `2026-07-20` | `2026-07-20T18:13:47Z` |
| biotechnology | **0** | — | `null` |
| space | **0** | — | `null` |

Quantum's and AI's 100 each came from a single LOCAL `npm run fetch-data`
on 2026-07-20 (which reads `.env.local`, where the credentials do live),
committed as part of that day's manual data restore. They survived only
because `entries[]` accumulates and never drops an id, which is precisely
why nothing looked broken for six weeks. Biotechnology and space, both
created 2026-09-02, postdate that local run and so had no patents at all —
their innovation stage was papers-only and silently missing a whole
source.

The fix was three `gh secret set` calls (`EPO_KEY`, `EPO_SECRET`, and
`OPENALEX_KEY` while there). Verified two ways. First, the credentials
themselves were tested locally before waiting on CI, since nothing had
exercised them in 45 days and a lapsed key would look identical from the
outside — auth returned a token and space's real CPC query returned 27,864
results (`B64G`'s 25,876 plus `H04B7/185`'s ~2,000, matching what was
measured when the vertical was built). Then run `33785902526` logged
`EPO: 100 patents` four times, once per vertical, and all four
`lastSuccessfulPull` values moved to `2026-09-03`. Quantum and AI went to
200 patents (the stale 100 plus 100 fresh), biotechnology and space to
100 from zero. No `WO`/`EP`/`IB` authority leaked into a `country` field
in any of the four, which is `NON_COUNTRY_PATENT_AUTHORITIES`
(`epo.ts`) working on real data rather than only in principle.

**Setting `OPENALEX_KEY` created a new risk that had to be guarded.**
Until then `openalex.ts` sent no `api_key` param at all and ran on the
keyless polite pool via `mailto`. A key that OpenAlex rejects would throw,
`fetch-data.ts` would soft-fail the source, and all four verticals' papers
would stop growing behind a green run — the same silent-degradation shape
as the EPO miss itself, landing on the one source every vertical's
innovation stage depends on. So `oaFetch` now drops the key, warns once,
and retries keyless on a 401/403, with a module-level `keyRejected` flag
so one rejection converts the rest of the run instead of re-spending a 403
on each of the ~200 paged calls a four-vertical fetch makes. The key was
accepted on the first real run, so the fallback has not yet fired.

One caveat on the counts: `EPO: 100 patents` is a per-run ceiling, not a
corpus measurement. Patents accumulate 100 per vertical per run now that
this works, so expect that number to climb and don't read it as "there are
100 space patents."

A note on GitHub Actions concurrency, learned by breaking it here: this
workflow sets `concurrency: {group: pages, cancel-in-progress: false}`,
and `cancel-in-progress: false` governs only IN-PROGRESS runs. GitHub
keeps just **one** pending run per group, so pushing while a run is queued
cancels the queued one. A `workflow_dispatch` run was lost that way
mid-session. If you dispatch a run to test something, don't push until it
starts.

The original note, still accurate for the Worker side and for the shape of
the mistake to watch for:
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
  accumulation both depend on it for every vertical) — to the `data` branch,
  not `main` (see "Data lives on its own branch" above; that split happened
  2026-07-20, don't revert it back onto `main`). Since 2026-07-20 this
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
git fetch origin data && git archive origin/data -- public/data | tar -x
                          # one-time after a fresh clone: public/data/ is gitignored on
                          # main and empty until you pull the real accumulated history
                          # off the `data` branch this way (see "Data lives on its own
                          # branch"). Skip this if you'd rather start cold with fetch-data.
npm run fetch-data       # loops over every VERTICALS entry, writes public/data/<id>.json each (watch the source lines it prints)
npm run backfill-trend -- <vertical-id>   # one-time: reconstructs past trend[] history from real OpenAlex dates (defaults to quantum-computing)
npm run backfill-entries -- <vertical-id> # one-off top-up: deep OpenAlex/NSF pull merged into entries[] (defaults to quantum-computing)
npm run gen-continent-map # regenerate src/lib/continentMap.ts (only if the ISO list changes)
npm run form-d-sector-tracker -- <n>  # standalone research script (NOT part of the app's data
                          # pipeline) — pulls the n most recent SEC Form D bulk quarterly
                          # datasets, dedupes D/A amendments, excludes pooled-investment-fund
                          # filings, and writes output/form-d-by-sector.csv (gitignored, real
                          # generated data). Edit SECTORS_OF_INTEREST at the top of
                          # scripts/form-d-sector-tracker.ts to change which of EDGAR's real
                          # INDUSTRYGROUPTYPE values get included — the full real taxonomy
                          # prints to the console on every run.
npm run import-capiq-rd-export -- <path-to-xlsx>  # one-off/periodic: parses a manually-exported
                          # S&P Capital IQ Pro Companies-screener report (IQ_RD_EXP_FN field) and
                          # writes data/capiq/rd-spend.ts — see "Foreign R&D spend (S&P Capital IQ)"
                          # above. Re-run after a fresh export; never commit the raw .xlsx itself.
npm run import-capiq-transactions -- <path-to-xlsx> <vertical-id> [required-topic-tag] [--industry=A,B] [--replace]  # one-off/
                          # periodic: parses a manually-exported S&P Capital IQ Pro Transactions-
                          # screener report and writes data/capiq/vc-funding.ts — see "VC funding
                          # tracking (S&P Capital IQ Transactions)" above. <vertical-id> tags which
                          # vertical this export's rows belong to (e.g. "artificial-intelligence") —
                          # re-importing one vertical merges into, rather than erasing, another
                          # vertical's already-imported data (and dedupes overlapping deals within
                          # the same vertical too, by CapIQ's own transaction id). The optional 3rd
                          # arg requires the export's own Topic Tags column to contain that exact
                          # substring — necessary when CapIQ's tag search was broader than the real
                          # target (e.g. quantum computing has no dedicated tag, only "Encryption"/
                          # "Post-Quantum Cryptography" — pass the latter to exclude unrelated
                          # cybersecurity companies the broader tag swept in). `--industry=A,B`
                          # filters on SPTR_IQ_TARGET_PRIMARY_INDUSTRY (CapIQ's own GICS industry
                          # for the target) instead, and is the BETTER filter when the export has
                          # that column — it classifies the company rather than keyword-matching it.
                          # `--replace` discards this vertical's previously-imported rows instead of
                          # merging into them; use it to correct a mis-scoped earlier import, not to
                          # add a second tag search (that's what the default merge is for).
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
