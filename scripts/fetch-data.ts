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
import type { DataFile, Entry, StageNote, TrendPoint } from "../src/lib/types.ts";
import { fetchOpenAlexPages } from "../src/lib/sources/openalex.ts";
import { fetchPatents } from "../src/lib/sources/epo.ts";
import { fetchNSF } from "../src/lib/sources/nsf.ts";
import { fetchNewsRss, fetchInvestmentNews } from "../src/lib/sources/rss.ts";
import { asArray } from "../src/lib/sources/util.ts";
import { VERTICALS, type VerticalConfig } from "../src/lib/verticals.ts";
import { canonicalizeOrg } from "../src/lib/entityResolution.ts";
import { relevanceScoreFor } from "../src/lib/relevanceScore.ts";
import { buildSourceMeta } from "../src/lib/sourceMeta.ts";
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

const OA_KEY = process.env.OPENALEX_KEY ?? "";
const OA_MAILTO = process.env.OPENALEX_MAILTO ?? "gtm@example.com";
const EPO_KEY = process.env.EPO_KEY ?? "";
const EPO_SECRET = process.env.EPO_SECRET ?? "";

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

function readPrevious(outPath: string): DataFile | null {
  if (!existsSync(outPath)) return null;
  try { return JSON.parse(readFileSync(outPath, "utf8")) as DataFile; }
  catch { return null; }
}

function trendPoint(live: Entry[]): TrendPoint {
  const counts: Record<string, number> = {};
  for (const e of live) {
    if (e.stage !== "innovation" || !e.country) continue;
    counts[e.country] = (counts[e.country] ?? 0) + 1;
  }
  return { date: new Date().toISOString().slice(0, 10), counts };
}

async function fetchVertical(v: VerticalConfig): Promise<void> {
  const outPath = resolve(OUT_DIR, `${v.id}.json`);
  console.log(`\n=== ${v.label} (${v.id}) ===`);

  let live: Entry[] = [];
  let sourceUsed = "openalex";
  let openalexOk = false;
  let arxivOk = false;
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
  for (const e of [...seed, ...live, ...patents, ...funding, ...news, ...investmentNews]) {
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
  const trend = live.length > 0 ? [...history, trendPoint(live)] : history;

  const sourceMeta = buildSourceMeta(prev?.sourceMeta, {
    openalex: openalexOk,
    "arxiv-fallback": arxivOk,
    epo: epoOk,
    nsf: nsfOk,
    "rss-news": rssNewsOk,
    "rss-investment": rssInvestmentOk,
    seed: seed.length > 0, // a static import, not a fetch — always "succeeds" when configured
  }, now);

  const out: DataFile = {
    technology: v.id,
    generatedAt: now,
    entries: [...byId.values()],
    trend,
    notes,
    sourceMeta,
  };

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
