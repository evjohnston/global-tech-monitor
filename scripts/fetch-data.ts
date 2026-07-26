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
import { fetchOpenAlexPages, fetchTopCitedPages } from "../src/lib/sources/openalex.ts";
import { fetchPatents } from "../src/lib/sources/epo.ts";
import { fetchNSF } from "../src/lib/sources/nsf.ts";
import { fetchCompanySnapshots } from "../src/lib/sources/massive.ts";
import { fetchRdSpendByYear } from "../src/lib/sources/secEdgar.ts";
import { CAPIQ_RD_SPEND } from "../data/capiq/rd-spend.ts";
import { CAPIQ_VC_FUNDING } from "../data/capiq/vc-funding.ts";
import { fetchNewsRss, fetchInvestmentNews } from "../src/lib/sources/rss.ts";
import { asArray } from "../src/lib/sources/util.ts";
import { VERTICALS, type VerticalConfig } from "../src/lib/verticals.ts";
import { canonicalizeOrg } from "../src/lib/entityResolution.ts";
import { relevanceScoreFor } from "../src/lib/relevanceScore.ts";
import { buildSourceMeta } from "../src/lib/sourceMeta.ts";
import { periodCounts, periodFunding } from "../src/lib/aggregate.ts";
import { SEED as QUANTUM_SEED } from "../data/quantum/seed.ts";
import { NOTES as QUANTUM_NOTES } from "../data/quantum/notes.ts";
import { SEED as AI_SEED } from "../data/ai/seed.ts";
import { NOTES as AI_NOTES } from "../data/ai/notes.ts";

// Static imports rather than a dynamic-import registry — fine at this scale
// (a handful of verticals); revisit if this list grows large.
const SEED_BY_VERTICAL: Record<string, Entry[]> = {
  "quantum-computing": QUANTUM_SEED,
  "artificial-intelligence": AI_SEED,
};
const NOTES_BY_VERTICAL: Record<string, StageNote[]> = {
  "quantum-computing": QUANTUM_NOTES,
  "artificial-intelligence": AI_NOTES,
};

// Which of data/capiq/rd-spend.ts's foreign companies (real, named quantum/
// AI programs, but 20-F filers SEC EDGAR can't reach — see CLAUDE.md)
// count toward each vertical's R&D-spend chart. Deliberately separate
// from verticals.ts's `tickers` (Massive/market-panel list) — these 11
// resolve on Massive's reference endpoint but carry no market-cap data on
// the current plan tier, so they're excluded from the market panel but
// still real, disclosed, individually-verified companies worth counting
// here.
const CAPIQ_TICKERS_BY_VERTICAL: Record<string, string[]> = {
  "quantum-computing": ["ARRXF", "BAESY", "FJTSY", "NTTYY", "NIPNF", "MIELY", "EADSY", "THLLY", "SSNLF"],
  "artificial-intelligence": ["TCEHY", "SFTBY", "SSNLF"],
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
const OA_PAGES = 3; // up to 600 works/run, covers the great majority of a 30-day window
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
  for (const e of CAPIQ_RD_SPEND) {
    if (!relevant.has(e.symbol)) continue;
    const point = byYear.get(e.fiscalYear) ?? { fiscalYear: e.fiscalYear, totalUsd: 0, companies: [] };
    point.totalUsd += e.amountUsd;
    point.companies.push({ symbol: e.symbol, amountUsd: e.amountUsd, source: "capiq" });
    byYear.set(e.fiscalYear, point);
  }
  return [...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear);
}

function trendPoint(live: Entry[], allEntries: Entry[], prevPoint?: TrendPoint): TrendPoint {
  const rawCounts: Record<string, number> = {};
  for (const e of live) {
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
  const todayTotal = Object.values(rawCounts).reduce((a, b) => a + b, 0);
  const prevTotal = prevPoint ? Object.values(prevPoint.counts).reduce((a, b) => a + b, 0) : 0;
  const degraded = !!prevPoint && prevTotal >= 20 && todayTotal < prevTotal * 0.15;
  const counts = degraded ? prevPoint!.counts : rawCounts;
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
  };
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

  // Patents and funding are additive and each fails soft — a missing key or
  // a down endpoint drops that source without breaking the build.
  let patents: Entry[] = [];
  let epoOk = false;
  try {
    patents = await fetchPatents(EPO_KEY, EPO_SECRET, EPO_N, v.epoCpcQuery);
    epoOk = true;
    console.log(`EPO: ${patents.length} patents`);
  } catch (err) {
    console.error("patents skipped:", (err as Error).message);
  }
  let funding: Entry[] = [];
  let nsfOk = false;
  try {
    funding = await fetchNSF(NSF_N, v.fundingKeyword, v.rssClassifier.relevant);
    nsfOk = true;
    console.log(`NSF: ${funding.length} grants`);
  } catch (err) {
    console.error("funding skipped:", (err as Error).message);
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
  for (const e of [...seed, ...live, ...patents, ...funding, ...news, ...investmentNews, ...topCited]) {
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

  const vcFundingAll = CAPIQ_VC_FUNDING.filter((c) => c.vertical === v.id).map(({ vertical: _vertical, ...rest }) => rest);
  const vcFundingForVertical = vcFundingAll.slice(0, VC_FUNDING_CAP);
  if (vcFundingAll.length > VC_FUNDING_CAP) {
    console.log(`CapIQ VC funding: capped ${vcFundingAll.length} companies to top ${VC_FUNDING_CAP} for the public data file`);
  }

  const sourceMeta = buildSourceMeta(prev?.sourceMeta, {
    openalex: openalexOk,
    "arxiv-fallback": arxivOk,
    epo: epoOk,
    nsf: nsfOk,
    massive: massiveOk,
    "sec-edgar": secEdgarOk,
    capiq: capiqTickers.length > 0, // a static hand-imported file, not a live fetch — see data/capiq/rd-spend.ts
    "capiq-transactions": CAPIQ_VC_FUNDING.some((c) => c.vertical === v.id), // see data/capiq/vc-funding.ts
    "rss-news": rssNewsOk,
    "rss-investment": rssInvestmentOk,
    seed: seed.length > 0, // a static import, not a fetch — always "succeeds" when configured
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
