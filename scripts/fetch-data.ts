/**
 * Global Tech Monitor — data fetch
 *
 * Runs in Node (locally via `npm run fetch-data`, or daily on GitHub Actions).
 * Loops over every configured vertical in src/lib/verticals.ts and writes one
 * public/data/<vertical-id>.json per vertical — adding a vertical means
 * adding one entry to VERTICALS plus a data/<id>/{seed,notes}.ts pair, not
 * touching this file.
 *
 * Sources, per vertical:
 *   - OpenAlex for innovation-stage works, filtered by that vertical's
 *     OpenAlex filter fragment, restricted to journal-type sources. Falls
 *     back to arXiv (no affiliations, keyword-inferred country) if OpenAlex
 *     is unreachable, so the build never fails hard.
 *   - EPO patents (innovation stage) via that vertical's CPC query.
 *   - NSF grants (investment stage) via that vertical's funding keyword.
 *   - RSS (src/lib/sources/rss.ts) for scaling/adoption — auto-classified
 *     from that vertical's trade press, weakest attribution tier
 *     (provenance "auto"). Supplements, doesn't replace, data/<id>/seed.ts.
 *   - Google News RSS (src/lib/sources/rss.ts, fetchInvestmentNews) for
 *     investment-stage funding news — same "auto" tier, personal/
 *     non-commercial use only per Google News's feed license (see the
 *     comment above fetchInvestmentNews before reusing this elsewhere).
 *   - data/<id>/seed.ts for scaling/adoption — the hand-verified floor.
 *   - data/<id>/notes.ts for the analyst "so what" layer.
 *
 * Every entry logs the real country an institution/awardee/filer is located
 * in (ISO alpha-2), not a US/China/Europe/Other bucket — see
 * src/lib/types.ts and src/lib/countries.ts.
 *
 * Accumulation: reads the PREVIOUS public/data/<id>.json and appends one
 * trend point per run, so country-share history and entries[] both build up
 * over time instead of being overwritten (see the byId construction below —
 * it seeds from prev.entries first, same reasoning as trend[]).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { XMLParser } from "fast-xml-parser";

// Running this script directly with tsx (as opposed to through Vite) reads
// nothing from .env.local on its own — Vite's env-loading only applies to
// `npm run dev`/`build`. Load it explicitly so a local `npm run fetch-data`
// can pick up real EPO_KEY/EPO_SECRET/OPENALEX_KEY the same way the GitHub
// Actions workflow's `env:` block does in CI.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local") });
import { inferInstitutionCountry } from "../src/lib/institutionCountry.ts";
import type { DataFile, Entry, StageNote, TrendPoint, RdSpendPoint } from "../src/lib/types.ts";
import { DETAIL_RETENTION_DAYS } from "../src/lib/types.ts";
import { fetchOpenAlexPages, fetchTopCitedPages } from "../src/lib/sources/openalex.ts";
import { fetchPatents, NON_COUNTRY_PATENT_AUTHORITIES } from "../src/lib/sources/epo.ts";
import { fetchNSF } from "../src/lib/sources/nsf.ts";
import { fetchUsaSpendingAwards, fetchFederalGrants } from "../src/lib/sources/usaSpending.ts";
import { fetchSamOpportunities } from "../src/lib/sources/samGov.ts";
import { fetchCompanySnapshots } from "../src/lib/sources/massive.ts";
import { fetchRdSpendByYear, trimIncompleteTail } from "../src/lib/sources/secEdgar.ts";
import { CAPIQ_RD_SPEND } from "../data/capiq/rd-spend.ts";
import { CAPIQ_VC_FUNDING } from "../data/capiq/vc-funding.ts";
import { PITCHBOOK_VC_FUNDING } from "../data/pitchbook/vc-funding.ts";
import { fetchNewsRss, fetchInvestmentNews } from "../src/lib/sources/rss.ts";
import { asArray, truncateAbstract } from "../src/lib/sources/util.ts";
import { VERTICALS, type VerticalConfig } from "../src/lib/verticals.ts";
import { canonicalizeOrg } from "../src/lib/entityResolution.ts";
import { relevanceScoreFor } from "../src/lib/relevanceScore.ts";
import { buildSourceMeta } from "../src/lib/sourceMeta.ts";
import { periodCounts, periodFunding } from "../src/lib/aggregate.ts";
import { LIVE_WINDOW_CAP, LEGACY_WINDOW_CAP } from "../src/lib/sources/openalex.ts";
import { SEED as QUANTUM_SEED } from "../data/quantum/seed.ts";
import { NOTES as QUANTUM_NOTES } from "../data/quantum/notes.ts";
import { SEED as AI_SEED } from "../data/ai/seed.ts";
import { NOTES as AI_NOTES } from "../data/ai/notes.ts";
import { SEED as BIOTECH_SEED } from "../data/biotech/seed.ts";
import { NOTES as BIOTECH_NOTES } from "../data/biotech/notes.ts";
import { SEED as SPACE_SEED } from "../data/space/seed.ts";
import { NOTES as SPACE_NOTES } from "../data/space/notes.ts";

// Static imports rather than a dynamic-import registry — fine at this scale
// (a handful of verticals); revisit if this list grows large.
const SEED_BY_VERTICAL: Record<string, Entry[]> = {
  "quantum-computing": QUANTUM_SEED,
  "artificial-intelligence": AI_SEED,
  biotechnology: BIOTECH_SEED,
  space: SPACE_SEED,
};
const NOTES_BY_VERTICAL: Record<string, StageNote[]> = {
  "quantum-computing": QUANTUM_NOTES,
  "artificial-intelligence": AI_NOTES,
  biotechnology: BIOTECH_NOTES,
  space: SPACE_NOTES,
};

// Which of data/capiq/rd-spend.ts's foreign companies (real, named quantum/
// AI programs, but 20-F filers SEC EDGAR can't reach — see CLAUDE.md)
// count toward each vertical's R&D-spend chart. Deliberately separate
// from verticals.ts's `tickers` (Massive/market-panel list) — these 11
// resolve on Massive's reference endpoint but carry no market-cap data on
// the current plan tier, so they're excluded from the market panel but
// still real, disclosed, individually-verified companies worth counting
// here.
// No biotechnology entry yet, deliberately rather than by oversight: that
// vertical has exactly the same problem (RHHBY/Roche and NVZMY/Novonesis
// both resolve on Massive but carry no market cap, and both are genuinely
// major — Roche is one of the largest biologics manufacturers in the
// world, Novonesis the largest industrial-enzyme company), but
// data/capiq/rd-spend.ts predates the vertical and contains neither
// company. Adding them needs a fresh manual CapIQ Companies-screener
// export, which is Windows-only and can't be done from here. Listing them
// here without the underlying data would just merge nothing.
// Expanded 2026-09-02 from a fresh export. Two kinds of entry now: the
// original foreign 20-F filers that carry no Massive market cap and so
// aren't in `tickers` at all, plus companies that ARE in a vertical's
// `tickers` but that SEC can't give a USD R&D figure for — either they
// report only in their home currency (ASML in EUR, GSK GBP, Takeda JPY,
// BioNTech EUR) or they tag no standalone R&D concept at all (L3Harris,
// Innodata, Nautilus, Atrium). Overlap with SEC coverage is safe: the
// merge above skips any (symbol, year) SEC already supplied.
const CAPIQ_TICKERS_BY_VERTICAL: Record<string, string[]> = {
  "quantum-computing": ["ARRXF", "BAESY", "FJTSY", "NTTYY", "NIPNF", "MIELY", "EADSY", "THLLY", "SSNLF", "ASML", "LHX"],
  "artificial-intelligence": ["TCEHY", "SFTBY", "SSNLF", "ASML", "BABA", "BIDU", "INOD", "NBIS", "SAP", "TSM"],
  biotechnology: ["BNTX", "GSK", "NAUT", "RNA", "TAK"],
  // Airbus, Thales and BAE all resolve on Massive without market cap (so
  // they're excluded from space's `tickers`) but are real, already-imported
  // CapIQ companies with major space businesses — BAE's includes the former
  // Ball Aerospace, acquired 2024.
  space: ["EADSY", "THLLY", "BAESY"],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/data");

// Per-request caps, one per source — each API has a different real ceiling,
// checked by hand before picking these (for quantum; other verticals inherit
// the same caps until proven to need something different): OpenAlex's
// per-page max is 200 (confirmed), and the Topic+journal query matched 476
// works in a 30-day window when checked, so OA_PAGES pages the request past
// the per-page cap to reach more of that real total. NSF's awardapi accepts
// rpp up to at least 500 (confirmed), EPO OPS search caps around 100 per
// request on the free tier (per their docs).
const OA_N = 200;
// 50 pages x 200 = 10,000, which is OpenAlex's hard ceiling for basic
// (page-number) paging — past that it requires cursor paging. Raised from 3
// on 2026-09-02 after measuring what the old 600-work ceiling actually
// covered of each vertical's real 30-day journal corpus:
//   quantum   727 works -> 82.5% covered
//   AI     10,763 works ->  5.6% covered
//   biotech 9,784 works ->  6.1% covered
// Every country chart, the world map, the institution leaderboard and the
// stage breakdown are computed from entries[] (see aggregate.ts's
// countByCountry, and Overview.tsx), so for two of three verticals those
// panels were reading a 6% slice — and because the query sorts
// publication_date:desc, a systematically biased slice rather than a random
// one: fast-publishing journals and countries whose work lands sooner were
// overrepresented. A deeper reach also picks up works OpenAlex indexes late
// with an older publication_date, which a shallow "most recent N" snapshot
// can never see at all.
//

// Entry.date is a real publication/award/announcement date, but it comes from
// several sources and a malformed one must not silently age an entry out of
// its own detail. An unparseable date returns 0 — treated as brand new, so
// the entry keeps everything.
function ageInDays(date: string | undefined, nowIso: string): number {
  if (!date) return 0;
  const t = Date.parse(date.slice(0, 10));
  if (!Number.isFinite(t)) return 0;
  return (Date.parse(nowIso) - t) / 864e5;
}

// Affordable only because abstracts are now capped (see truncateAbstract in
// sources/util.ts) — they were 69.4% of the payload. Net effect is that all
// three files get SMALLER than quantum's previous 18MB while carrying full
// coverage. `fetchOpenAlexPages` stops early on the first empty page, so
// quantum still costs ~4 requests, not 50.
//
// If you change this, change LIVE_WINDOW_CAP in sources/openalex.ts with
// it — scripts/backfill-trend.ts reconstructs against that constant, and a
// mismatch is exactly the bug fixed on 2026-09-02.
const OA_PAGES = 50;
const NSF_N = 300;
const EPO_N = 100;
// Top 250 most-cited works of the last 5 years, ranked flat by citation
// count (no per-year grouping — see fetchTopCited's comment for why that
// changed 2026-07-20).
const TOP_CITED_SINCE_YEARS = 5;
const TOP_CITED_TOTAL = 250;

const OA_KEY = process.env.OPENALEX_KEY ?? "";
const OA_MAILTO = process.env.OPENALEX_MAILTO ?? "gtm@example.com";
const EPO_KEY = process.env.EPO_KEY ?? "";
const EPO_SECRET = process.env.EPO_SECRET ?? "";
const MASSIVE_KEY = process.env.MASSIVE_KEY ?? "";
const SAM_KEY = process.env.SAM_KEY ?? "";

// ── arXiv fallback (no country codes → keyword inference) — only reached if
// OpenAlex itself is unreachable, not a fresher alternate feed. ───────────
async function fetchArxiv(category: string): Promise<Entry[]> {
  const url =
    `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(category)}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${OA_N}`;
  const res = await fetch(url, { headers: { "User-Agent": "GlobalTechMonitor/0.2 (research dashboard)" } });
  if (!res.ok) throw new Error(`arXiv HTTP ${res.status}`);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(await res.text());
  const raw = asArray<any>(parsed?.feed?.entry);
  return raw.map((e): Entry => {
    const title = String(e.title ?? "").replace(/\s+/g, " ").trim();
    const authors = asArray<any>(e.author);
    const names = authors.map((a) => a.name).filter(Boolean);
    const org = names.length > 1 ? `${names[0]} et al.` : names[0] ?? "";
    const links = asArray<any>(e.link);
    const alt = links.find((l) => l["@_rel"] === "alternate");
    const url = alt?.["@_href"] ?? e.id ?? `https://arxiv.org/list/${category}/recent`;
    // "auto" provenance, not "live" — this is the same keyword-guess
    // mechanism as the RSS layer, just applied to arXiv metadata instead of
    // news headlines. It's only reached when OpenAlex itself is down.
    const { country, evidence } = inferInstitutionCountry(`${org} ${title}`);
    return {
      id: `arxiv-${String(e.id ?? "").split("/abs/")[1] ?? title.slice(0, 40)}`,
      stage: "innovation", country, provenance: "auto", source: "arxiv",
      title, org, date: String(e.published ?? "").slice(0, 10), url,
      countryEvidence: `${evidence} (arXiv fallback, no institution country data)`,
    };
  });
}

// A JSON parse failure here used to return null silently — which reads to
// every caller exactly like "no previous file, this is a fresh vertical,"
// so accumulation quietly restarted from zero instead of failing loudly.
// Confirmed as the real cause of a live incident (2026-07-20): a human
// merge conflict left literal <<<<<<< markers in quantum-computing.json (a
// recurrence of an earlier corruption this exact file already had once
// today), the next run's readPrevious() choked on it and returned null,
// and that run committed a ~280-entry, 30-trend-point regression with no
// error anywhere in the logs — the only sign was the live dashboard's
// numbers dropping. Logging here doesn't fix the corruption, but it means
// the next incident shows up in the workflow's own output instead of
// silently downstream in the KPI row.
function readPrevious(outPath: string): DataFile | null {
  if (!existsSync(outPath)) return null;
  try { return JSON.parse(readFileSync(outPath, "utf8")) as DataFile; }
  catch (err) {
    console.error(`readPrevious: ${outPath} exists but failed to parse (${(err as Error).message}) — treating as no previous data, which will look like a regression if this file really did have history. Fix the file, don't just rerun.`);
    return null;
  }
}

// `live` (this run's fresh OpenAlex/arXiv pull, a rolling ~30d window) feeds
// `counts` — unchanged from before. `allEntries` (the full accumulated set,
// post-merge) feeds the newer fields via the exact same periodCounts/
// periodFunding a live page render uses, so a history point means the same
// thing a live "trailing 21d" KPI does: entries whose real event date falls
// in the last TREND_WINDOW_DAYS as of this run, not a cumulative-forever
// total (which would just monotonically grow and never show a real trend).
const TREND_WINDOW_DAYS = 21;
// CAPIQ_VC_FUNDING can carry tens of thousands of companies with full
// deal-level detail (a 5-year AI export produced 21,001) — shipping all
// of that into the browser-facing public/data/<id>.json would blow up
// what's supposed to be a small, "static, instant" payload (see CLAUDE.md
// on the app's whole design premise) for no real benefit, since
// VcFundingLeaderboard.tsx only ever renders a top-N table anyway. The
// full, real, unlimited dataset still lives in the committed data/capiq/
// vc-funding.ts for anyone auditing it directly — only the public JSON
// gets capped, and the drop is logged, not silent.
const VC_FUNDING_CAP = 200;
// Layers hand-imported CapIQ R&D figures (foreign 20-F filers) onto SEC
// EDGAR's already fiscal-year-trimmed rdSpend series. Additive per year —
// creates a new year bucket if CapIQ has one SEC's tail-trim didn't keep
// (CapIQ's own figures are a static export, not subject to the "some
// filer hasn't reported yet" problem that trim exists for).
function mergeCapiqRdSpend(rdSpend: RdSpendPoint[], tickers: string[]): RdSpendPoint[] {
  const relevant = new Set(tickers);
  const byYear = new Map(rdSpend.map((p) => [p.fiscalYear, { ...p, companies: [...p.companies] }]));
  // SEC is the primary source and CapIQ only fills gaps, so a (symbol,
  // year) SEC already supplied is never added again. Load-bearing as of
  // 2026-09-02: before secEdgar.ts learned to try multiple XBRL concepts
  // and taxonomies, the CapIQ list and the SEC-covered list happened not to
  // overlap, and this merge added unconditionally. They overlap now —
  // Alibaba, Baidu, Nebius, SAP and TSMC all publish a PARTIAL USD series
  // at SEC alongside their home-currency one, so those years would have
  // been counted twice, once from each source, silently inflating the
  // total. Precedence goes to SEC because it's the free, live,
  // machine-readable feed; CapIQ is a periodic manual import that can go
  // stale between exports.
  const secAlreadyHas = new Set<string>();
  for (const p of rdSpend) {
    for (const c of p.companies) {
      if (c.source === "sec") secAlreadyHas.add(`${c.symbol}@${p.fiscalYear}`);
    }
  }
  let skippedAsDuplicate = 0;
  for (const e of CAPIQ_RD_SPEND) {
    if (!relevant.has(e.symbol)) continue;
    if (secAlreadyHas.has(`${e.symbol}@${e.fiscalYear}`)) { skippedAsDuplicate++; continue; }
    const point = byYear.get(e.fiscalYear) ?? { fiscalYear: e.fiscalYear, totalUsd: 0, companies: [] };
    point.totalUsd += e.amountUsd;
    point.companies.push({ symbol: e.symbol, amountUsd: e.amountUsd, source: "capiq" });
    byYear.set(e.fiscalYear, point);
  }
  if (skippedAsDuplicate > 0) {
    console.log(`CapIQ: skipped ${skippedAsDuplicate} (company, year) figures SEC EDGAR already supplied`);
  }
  // Re-trim after merging: CapIQ's export always carries the newest fiscal
  // year, so it re-creates whatever trailing year SEC's own trim just
  // dropped — populated by only the few companies CapIQ covers, which
  // reads as a collapse rather than as incomplete coverage. See
  // trimIncompleteTail in secEdgar.ts for the measured numbers.
  return trimIncompleteTail([...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear));
}

function trendPoint(live: Entry[], allEntries: Entry[], prevPoint?: TrendPoint): TrendPoint {
  // Counted from the LIVE_WINDOW_CAP most recently published works of this
  // run's fetch, not all of it. OA_PAGES is 50 now, so `live` holds up to
  // 10,000 works — but every trend point already on the data branch was
  // measured against a 3-page, 600-work fetch, and the series is only
  // meaningful if each point was measured the same way. Truncating here
  // reproduces what a 600-work run would have seen (the live query sorts
  // publication_date:desc, so the most recent 600 IS what it would have
  // returned) and keeps 75 recorded quantum points and 51 AI points
  // comparable instead of orphaning them. See LIVE_WINDOW_CAP in
  // openalex.ts for the full reasoning.
  const sampled = [...live]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, LIVE_WINDOW_CAP);
  const rawCounts: Record<string, number> = {};
  for (const e of sampled) {
    if (e.stage !== "innovation" || !e.country) continue;
    rawCounts[e.country] = (rawCounts[e.country] ?? 0) + 1;
  }
  // A run where country-attributed volume collapses to a sliver of the
  // prior day's real total (confirmed by hand, 2026-07-21: an OpenAlex
  // outage forced an arXiv fallback that structurally carries almost no
  // country data, so that day's attributed total cratered to ~1 while
  // true research volume stayed normal) used to get recorded as a
  // full-weight trend point anyway — reading downstream as one country
  // instantly at 0% share and another at 100%. Carry the prior day's real
  // counts forward instead of recording a visibly degraded snapshot, the
  // same "carry forward rather than blank on a transient failure"
  // convention already used for company snapshots (see massive.ts).
  // Only ever compared against a point recorded at the SAME window ceiling —
  // a prior point from before OA_PAGES was raised counts to a different
  // limit, so the ratio below would be meaningless across the boundary
  // (see TrendPoint.windowCap). Transitional in practice, but a
  // cross-ceiling comparison could either cry degradation on a healthy run
  // or hide a real one, and neither is worth risking for a one-line guard.
  const comparable = prevPoint && (prevPoint.windowCap ?? LEGACY_WINDOW_CAP) === LIVE_WINDOW_CAP ? prevPoint : undefined;
  const todayTotal = Object.values(rawCounts).reduce((a, b) => a + b, 0);
  const prevTotal = comparable ? Object.values(comparable.counts).reduce((a, b) => a + b, 0) : 0;
  const degraded = !!comparable && prevTotal >= 20 && todayTotal < prevTotal * 0.15;
  const counts = degraded ? comparable!.counts : rawCounts;
  const now = new Date();
  const stageCounts = { innovation: 0, scaling: 0, adoption: 0, investment: 0 } as Record<Entry["stage"], number>;
  for (const s of Object.keys(stageCounts) as Entry["stage"][]) {
    stageCounts[s] = periodCounts(allEntries, s, TREND_WINDOW_DAYS, now).current;
  }
  const fundingUsd = periodFunding(allEntries, TREND_WINDOW_DAYS, now).current;
  return {
    date: now.toISOString().slice(0, 10),
    counts,
    stageCounts,
    fundingUsd,
    totalEntries: allEntries.length,
    windowCap: LIVE_WINDOW_CAP,
  };
}

// Shared shape for this file's soft-failing per-source fetches (EPO, NSF,
// USASpending, SAM.gov, ...) — one implementation of "try, log+fall back to
// a default on failure" instead of a hand-copied try/catch per source, each
// with its own `xOk` boolean. Never rejects, so a caller can safely start
// one of these before it's actually needed (see the SAM.gov call in
// fetchVertical(), fired early to run concurrently with unrelated fetches)
// and await it whenever the result is required.
async function trackedFetch<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
  try {
    return { value: await fn(), ok: true };
  } catch (err) {
    console.error(`${label} skipped:`, (err as Error).message);
    return { value: fallback, ok: false };
  }
}

async function fetchVertical(v: VerticalConfig): Promise<void> {
  const outPath = resolve(OUT_DIR, `${v.id}.json`);
  console.log(`\n=== ${v.label} (${v.id}) ===`);

  let live: Entry[] = [];
  let sourceUsed = "openalex";
  let openalexOk = false;
  let arxivOk = false;
  // An empty openAlexFilter means this vertical's Innovation stage isn't a
  // paper corpus at all — skip OpenAlex/arXiv entirely rather than run a
  // query with nothing to filter on. No current vertical leaves this empty
  // (the one that did, Talent, was archived — see CLAUDE.md and the git
  // branch `archive/talent-vertical`); kept as generic dormant infrastructure
  // in case a future vertical needs a non-paper-corpus innovation stage.
  if (!v.openAlexFilter) {
    sourceUsed = "no-openalex-filter";
  } else {
    try {
      live = await fetchOpenAlexPages({
        filter: v.openAlexFilter, key: OA_KEY, mailto: OA_MAILTO, sinceDays: 30, n: OA_N, pages: OA_PAGES,
      });
      openalexOk = true;
      console.log(`OpenAlex: ${live.length} works with country attribution`);
    } catch (err) {
      console.error("OpenAlex failed:", (err as Error).message);
      try {
        live = await fetchArxiv(v.arxivCategory);
        sourceUsed = "arxiv-fallback";
        arxivOk = true;
        console.log(`arXiv fallback: ${live.length} works (no country data)`);
      } catch (err2) {
        console.error("arXiv also failed:", (err2 as Error).message);
        sourceUsed = "seed-only";
      }
    }
  }

  const prev = readPrevious(outPath);

  // Kicked off here, before patents/funding/companies/rdSpend/news, and not
  // awaited until it's actually needed below — SAM.gov opportunities depend
  // only on SAM_KEY + v.fundingKeyword (both already available), unlike
  // USASpending's award search just below, which genuinely needs Massive's
  // company list first. Running it concurrently with that whole chain
  // instead of serialized behind it costs nothing (trackedFetch never
  // rejects, so an early, not-yet-awaited failure just sits resolved until
  // collected).
  // `procurementKeyword` (falling back to fundingKeyword) rather than
  // fundingKeyword directly — see verticals.ts for the measured reason the
  // two came apart for biotechnology. Quantum and AI leave it unset and so
  // behave exactly as before.
  const procurementKeyword = v.procurementKeyword ?? v.fundingKeyword;
  const samPromise = trackedFetch(
    "SAM.gov",
    () => fetchSamOpportunities(SAM_KEY, procurementKeyword),
    [] as Entry[]
  );

  // Patents and funding are additive and each fails soft — a missing key or
  // a down endpoint drops that source without breaking the build.
  const { value: patents, ok: epoOk } = await trackedFetch("patents", () => fetchPatents(EPO_KEY, EPO_SECRET, EPO_N, v.epoCpcQuery), [] as Entry[]);
  if (epoOk) console.log(`EPO: ${patents.length} patents`);
  const { value: funding, ok: nsfOk } = await trackedFetch("funding", () => fetchNSF(NSF_N, v.fundingKeyword, v.rssClassifier.relevant), [] as Entry[]);
  if (nsfOk) console.log(`NSF: ${funding.length} grants`);

  // A second, program-number-filtered public-funding source, run only for
  // verticals where NSF's keyword search has been MEASURED to be the wrong
  // instrument (space, so far — see grantProgramNumbers in verticals.ts).
  // Additive rather than a replacement: NSF still returns some real awards,
  // and dropping accumulated history would be worse than carrying a
  // disclosed mix of two sources that both land as source:"grant".
  const { value: agencyGrants, ok: agencyGrantsOk } = v.grantAgency && v.grantProgramNumbers?.length
    ? await trackedFetch(
        "agency grants",
        () => fetchFederalGrants(v.grantAgency!, v.grantProgramNumbers!, v.grantAgencyTier ?? "toptier"),
        [] as Entry[],
      )
    : { value: [] as Entry[], ok: undefined };
  if (agencyGrantsOk) {
    const sum = agencyGrants.reduce((t, e) => t + (e.amountUsd ?? 0), 0);
    console.log(`${v.grantAgency} grants (CFDA ${v.grantProgramNumbers?.join(", ")}): ${agencyGrants.length} awards, $${(sum / 1e6).toFixed(0)}M`);
  }
  // Not part of entries[]/the byId merge below — a market snapshot isn't a
  // discrete dated event, it's a standing fact about a company. On a
  // transient failure, carry the previous run's snapshot forward rather
  // than blanking the panel (same reasoning as sourceMeta's
  // lastSuccessfulPull), since a stale market cap is still a real number,
  // just not today's.
  let companies = prev?.companies ?? [];
  let massiveOk = false;
  try {
    const fetched = await fetchCompanySnapshots(v.tickers, MASSIVE_KEY);
    massiveOk = true;
    // fetchCompanySnapshots resolves (doesn't throw) even when every
    // individual ticker in the batch failed — e.g. a rate limit hit
    // mid-run — so an empty result here isn't reliably "nothing to show,"
    // it's often "this run failed entirely." Only overwrite the
    // carried-forward snapshot when something real came back, or when the
    // vertical genuinely has no tickers configured — otherwise a rate limit
    // would blank an otherwise-good panel instead of just leaving
    // yesterday's real numbers in place.
    if (fetched.length > 0 || v.tickers.length === 0) companies = fetched;
    console.log(`Massive: ${companies.length} companies`);
  } catch (err) {
    console.error("companies skipped:", (err as Error).message);
  }
  // Real, already-executed US federal contracts (Adoption stage,
  // deploymentStatus: "procurement") — one query per real company name
  // already resolved by Massive above, reusing the same fundingKeyword NSF
  // already searches on. See usaSpending.ts for why recipient+keyword
  // together (not recipient alone) keeps this precise on large diversified
  // companies. No API key needed.
  const { value: usaSpendingAwards, ok: usaSpendingOk } = await trackedFetch(
    "USASpending",
    () => fetchUsaSpendingAwards(companies.map((c) => canonicalizeOrg(c.name).name), procurementKeyword),
    [] as Entry[]
  );
  if (usaSpendingOk) console.log(`USASpending: ${usaSpendingAwards.length} federal contract awards`);
  // Real, currently-posted US federal solicitations (Adoption stage,
  // deploymentStatus: "announced", or "procurement" once a real award has
  // resulted) — same fundingKeyword as above. Needs SAM_KEY; soft-fails
  // like every other source here if it's unset. Fetch was kicked off
  // before patents/funding/companies above — this just collects the result.
  const { value: samOpportunities, ok: samGovOk } = await samPromise;
  if (samGovOk) console.log(`SAM.gov: ${samOpportunities.length} federal contract opportunities`);
  // Corporate R&D spend, free/no-key straight from SEC filings — a real
  // multi-year history in one pass, no daily accumulation needed (unlike
  // the NSF funding trend). See secEdgar.ts and DataFile.rdSpend for why
  // this is kept separate from the NSF-based investment aggregate.
  let rdSpend = prev?.rdSpend ?? [];
  let secEdgarOk = false;
  try {
    const fetched = await fetchRdSpendByYear(v.tickers);
    secEdgarOk = true;
    if (fetched.length > 0 || v.tickers.length === 0) rdSpend = fetched;
    console.log(`SEC EDGAR: R&D spend for ${fetched.length} fiscal years`);
  } catch (err) {
    console.error("R&D spend skipped:", (err as Error).message);
  }
  const capiqTickers = CAPIQ_TICKERS_BY_VERTICAL[v.id] ?? [];
  if (capiqTickers.length > 0) {
    rdSpend = mergeCapiqRdSpend(rdSpend, capiqTickers);
    console.log(`CapIQ: merged R&D spend for ${capiqTickers.length} foreign tickers`);
  }
  let news: Entry[] = [];
  let rssNewsOk = false;
  try {
    news = await fetchNewsRss(v.rssFeeds, v.rssClassifier, 30);
    rssNewsOk = true;
    console.log(`RSS: ${news.length} auto-classified scaling/adoption items`);
  } catch (err) {
    console.error("news skipped:", (err as Error).message);
  }
  let investmentNews: Entry[] = [];
  let rssInvestmentOk = false;
  try {
    investmentNews = await fetchInvestmentNews({ query: v.investmentNewsQuery, relevant: v.rssClassifier.relevant }, 30);
    rssInvestmentOk = true;
    console.log(`Google News: ${investmentNews.length} auto-classified investment items`);
  } catch (err) {
    console.error("investment news skipped:", (err as Error).message);
  }

  // Top-cited works of the last 5 years, ranked flat by citation count —
  // a different question than the rolling 30-day `live` pull above
  // (recency vs. citation impact), so its own query rather than folding
  // into it. Soft-fails same as every other source.
  let topCited: Entry[] = [];
  if (v.openAlexFilter) {
    try {
      topCited = await fetchTopCitedPages({ filter: v.openAlexFilter, sinceYears: TOP_CITED_SINCE_YEARS, total: TOP_CITED_TOTAL, key: OA_KEY, mailto: OA_MAILTO });
      console.log(`OpenAlex top-cited (last ${TOP_CITED_SINCE_YEARS}y): ${topCited.length} works`);
    } catch (err) {
      console.error("top-cited skipped:", (err as Error).message);
    }
  }

  // Entries accumulate across runs, the same way trend[] does — each night's
  // OpenAlex pull is only a rolling 30-day window, so without this, anything
  // older than 30 days (and every one-time backfill-entries.ts result) would
  // vanish the moment the next nightly run overwrote data/<id>.json. Seeding
  // the map from the previous file first, then layering this run's fetches
  // on top by id, means entries only grow or get refreshed, never disappear.
  const seed = SEED_BY_VERTICAL[v.id] ?? [];
  const notes = NOTES_BY_VERTICAL[v.id] ?? [];
  const now = new Date().toISOString();
  const byId = new Map<string, Entry>();
  for (const e of prev?.entries ?? []) byId.set(e.id, e);
  for (const e of [...seed, ...live, ...patents, ...funding, ...agencyGrants, ...news, ...investmentNews, ...topCited, ...usaSpendingAwards, ...samOpportunities]) {
    // ingestedAt is stamped once, at first sight, and preserved on every
    // later re-fetch of the same id — it must never reset to "now" just
    // because a source returned the same entry again.
    const existing = byId.get(e.id);
    byId.set(e.id, { ...e, ingestedAt: existing?.ingestedAt ?? now });
  }
  // orgId/relevanceScore are derived fields, cheap and idempotent to
  // recompute — unlike ingestedAt, there's no "first seen" meaning to
  // preserve, so every run recomputes them for every entry. That makes them
  // self-healing if entityResolution's alias table or the relevance
  // heuristic improves later, instead of freezing whatever value an entry
  // happened to get the run it was first ingested.
  for (const e of byId.values()) {
    if (e.org) e.orgId = canonicalizeOrg(e.org).id;
    e.relevanceScore = relevanceScoreFor(e.source, e.provenance);
    if (!e.ingestedAt) e.ingestedAt = now; // entries from before this field existed
    // Both of these are corrections applied to EVERY entry every run, not
    // just freshly-fetched ones, so accumulated history heals itself
    // instead of carrying a permanent seam at the date the fix shipped —
    // same reasoning as orgId/relevanceScore being recomputed above.
    //
    // Abstracts: capped at ingest now (see truncateAbstract), but entries
    // already in the file predate that and were the single largest thing
    // in this app's payload — 69.4% of quantum's 17.9MB entries[] array.
    e.abstract = truncateAbstract(e.abstract);
    // Past this age an entry keeps everything an aggregate, a filter or an
    // audit reads, and loses only the three fields that exist to fill one
    // record's drawer. That bounds the growth rate rather than the corpus:
    // entries[] still accumulates forever and never drops an id, so
    // "output by country" stays a real all-time count.
    //
    // Measured per entry, gzipped: 203 bytes fresh, 99 aged. At the current
    // ~350 entries/day that is 12.6 MB of growth a year instead of 36.7 MB.
    // Deliberately NOT stripped: countryEvidence (every attribution has to
    // stay auditable — see CLAUDE.md's provenance tiers), orgId, citations
    // and collaboratingCountries, all of which real aggregates read.
    if (ageInDays(e.date, now) > DETAIL_RETENTION_DAYS) {
      delete e.abstract;
      delete e.authors;
      delete e.venue;
    }
    // Regional/international patent authorities (WO, EP, ...) were being
    // stored as if they were countries — see epo.ts for the measured
    // impact and why null is right.
    if (e.source === "patent" && e.country && NON_COUNTRY_PATENT_AUTHORITIES.has(e.country)) {
      e.countryEvidence = `Published by ${e.country}, a regional or international patent authority rather than a country — not attributable to one nation`;
      e.country = null;
    }
  }

  // Append today's trend point, keeping prior history. One point per date.
  // Also drops any leftover pre-refactor us/cn/eu/other-bucket point — real
  // country codes are never lowercase, so this is an unambiguous tell.
  const today = now.slice(0, 10);
  const history = (prev?.trend ?? []).filter(
    (p) => p.date !== today && !Object.keys(p.counts).some((k) => ["us", "cn", "eu", "other"].includes(k))
  );
  const allEntries = [...byId.values()];
  const trend = live.length > 0 ? [...history, trendPoint(live, allEntries, history[history.length - 1])] : history;

  // Two real, independently-imported providers, concatenated rather than
  // merged by company identity — a company can legitimately appear once
  // per provider (each keeps its own real orgId scheme), distinguished by
  // each deal's own `source` field. See scripts/import-pitchbook.ts's
  // header comment for why cross-provider entity resolution isn't
  // attempted. Re-sorted after concatenation so the cap below is an
  // honest top-N across both providers, not "all of CapIQ's list, then
  // whatever PitchBook slots fit."
  const vcFundingAll = [
    ...CAPIQ_VC_FUNDING.filter((c) => c.vertical === v.id).map(({ vertical: _vertical, ...rest }) => rest),
    ...PITCHBOOK_VC_FUNDING.filter((c) => c.vertical === v.id).map(({ vertical: _vertical, ...rest }) => rest),
  ].sort((a, b) => b.totalRaisedUsd - a.totalRaisedUsd);
  const vcFundingForVertical = vcFundingAll.slice(0, VC_FUNDING_CAP);
  if (vcFundingAll.length > VC_FUNDING_CAP) {
    console.log(`VC funding (CapIQ + PitchBook): capped ${vcFundingAll.length} companies to top ${VC_FUNDING_CAP} for the public data file`);
  }

  // `undefined` means NOT ATTEMPTED and is different from `false`, which
  // means attempted and errored. The distinction is real and the disclosure
  // panel renders it differently — "Not configured" versus "Failing" —
  // because telling a reader that EPO errored when it was never called is
  // its own small lie. Every source here fails soft, so this map is the only
  // place the difference survives into the shipped file.
  //
  // The trap worth knowing: trackedFetch reports ok:false for BOTH cases,
  // since fetchPatents throws "EPO key/secret not set" rather than
  // signalling a skip. So the credential check has to happen here, not be
  // inferred from the fetch result.
  const staticOrUnused = <T>(hasRows: boolean, _t?: T) => (hasRows ? true : undefined);
  const sourceMeta = buildSourceMeta(prev?.sourceMeta, {
    // An empty openAlexFilter means this vertical has no paper corpus, so
    // the query is never issued (see the sourceUsed branch above).
    openalex: v.openAlexFilter ? openalexOk : undefined,
    // Only reached when OpenAlex itself is unreachable. Not being needed is
    // this source working as designed, never a failure.
    "arxiv-fallback": openalexOk || !v.openAlexFilter ? undefined : arxivOk,
    // Credentials absent is a configuration state, not an error.
    epo: EPO_KEY && EPO_SECRET ? epoOk : undefined,
    nsf: nsfOk,
    usaspending: usaSpendingOk,
    // undefined for the three verticals that don't configure it — not
    // attempted, not failed.
    "agency-grants": agencyGrantsOk,
    // A real attempt that really does error most runs — SAM.gov's non-federal
    // key has a daily quota, so `false` here is accurate rather than a stand-in
    // for "skipped". See the long comment at the top of samGov.ts.
    "sam-gov": SAM_KEY ? samGovOk : undefined,
    massive: MASSIVE_KEY ? massiveOk : undefined,
    "sec-edgar": secEdgarOk,
    // The four below are static committed imports rather than fetches, so
    // "no rows for this vertical" is an absence of imported data, not a
    // failed pull. Biotechnology's missing PitchBook coverage is the live
    // example — a real known gap, and not something that errored.
    capiq: staticOrUnused(capiqTickers.length > 0), // data/capiq/rd-spend.ts
    "capiq-transactions": staticOrUnused(CAPIQ_VC_FUNDING.some((c) => c.vertical === v.id)), // data/capiq/vc-funding.ts
    "pitchbook-transactions": staticOrUnused(PITCHBOOK_VC_FUNDING.some((c) => c.vertical === v.id)), // data/pitchbook/vc-funding.ts
    "rss-news": rssNewsOk,
    "rss-investment": rssInvestmentOk,
    seed: staticOrUnused(seed.length > 0),
  }, now);

  const out: DataFile = {
    technology: v.id,
    generatedAt: now,
    entries: allEntries,
    trend,
    notes,
    sourceMeta,
    companies,
    rdSpend,
    vcFunding: vcFundingForVertical,
  };

  // entries[]/trend[] only ever accumulate by design (see the byId merge
  // above) — a real drop of this size can only mean readPrevious() failed
  // to see real prior history (a corrupted file, a missing seed step), not
  // a legitimate day-to-day fluctuation. Refuse to overwrite good
  // accumulated history with a regression instead of writing (and this
  // repo's CI committing) a silent data loss — confirmed necessary by a
  // real incident (2026-07-20): a corrupted quantum-computing.json made
  // readPrevious() return null, and the run that followed happily wrote
  // ~280 fewer entries and 30 fewer trend points with no error anywhere.
  // Zero tolerance, not a percentage threshold — the byId merge above can
  // only ever preserve or add ids, never drop one, so entries.length is
  // mathematically incapable of decreasing on a correct run regardless of
  // scale. (A percentage cutoff here — originally 20% — missed the real
  // incident this guards against: the actual drop was ~18.5%, "close
  // enough" to look legitimate against a threshold, but still exactly the
  // failure mode described above.) This is a secondary check; the
  // authoritative one lives in build-and-deploy.yml's commit step, which
  // compares against origin/data's current state instead of this run's own
  // (possibly stale) seed — see that workflow file for why both exist.
  const prevCount = prev?.entries.length ?? 0;
  if (prev && out.entries.length < prevCount) {
    throw new Error(
      `refusing to write ${outPath}: ${out.entries.length} entries is fewer than the previous ${prevCount} — ` +
      `this can only mean readPrevious() couldn't read real prior history (check the log line above for a ` +
      `parse error, or that public/data/ was seeded correctly before this ran). Fix the actual cause; don't add ` +
      `a tolerance here to make the error go away.`
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    `wrote ${out.entries.length} entries, ${trend.length} trend points ` +
    `(source: ${sourceUsed}) → ${outPath}`
  );
}

async function main() {
  for (const v of VERTICALS) await fetchVertical(v);
}

main();
