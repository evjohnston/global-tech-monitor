// OpenAlex works fetch — shared by the Node fetch script (scripts/fetch-data.ts),
// the Cloudflare Worker, and the browser's live-refresh path. Runtime-agnostic:
// only uses global fetch, so it runs unmodified in Node 20+, Workers, and browsers.
//
// `opts.filter` is a raw OpenAlex filter fragment identifying the vertical —
// see src/lib/verticals.ts for the per-vertical values. Both verticals now
// use an explicit OR'd list of Topic ids (`topics.id:T1|T2|...`) rather than
// a single Topic or a whole Subfield rollup — OpenAlex's Topic taxonomy
// fragments AI across dozens of narrow application topics with no single
// cohesive "core AI" Topic the way quantum's core is T10682, and even a
// same-subfield rollup pulls in real noise (unrelated topics OpenAlex
// miscategorizes into that subfield), so each vertical's filter is a
// hand-checked list of the Topic ids that actually returned on-topic works
// on a live sample; see verticals.ts. Every
// vertical restricts to journal-type sources, NOT arXiv-as-primary-location:
// checked by hand for quantum that arXiv-as-primary-location gave 0/50 works
// with ANY institution data (arXiv doesn't collect structured affiliations
// at submission, and OpenAlex mostly never backfills it for preprints).
// Trade-off: journal publication lags preprints by weeks to months — the
// arXiv fallback below exists for when OpenAlex itself is unreachable, not
// as a "fresher" alternate feed.
import type { Entry } from "../types.ts";
import { inferInstitutionCountry } from "../institutionCountry.ts";
import { truncateAbstract } from "./util.ts";

// The TREND SERIES' sampling ceiling — deliberately NOT the same thing as
// how many works a run fetches, and deliberately NOT raised when OA_PAGES
// went from 3 to 50 on 2026-09-02.
//
// This is the correction to a mistake made earlier that same day. Raising
// OA_PAGES fixed the thing that needed fixing: entries[] now covers ~93-100%
// of each vertical's real corpus instead of a biased 6%, and entries[] is
// what every country chart, the world map and the institution leaderboard
// read from (aggregate.ts's countByCountry). trend[].counts is a different
// kind of number — a day-over-day COMPARISON, where what matters is that
// every point was measured the same way, not that any single point is a
// complete census. Raising this with OA_PAGES would have made every
// historical point incomparable and cost the deployed site 75 recorded
// quantum points and 51 AI points off its time-series charts, in exchange
// for nothing the coverage fix hadn't already delivered elsewhere.
//
// So the trend series stays pinned at the 600 it has always used, and
// trendPoint() in scripts/fetch-data.ts truncates each run's (now much
// larger) fetch to the 600 most recently published works before counting —
// reproducing exactly what a 3-page run would have seen. The honest caveat,
// which was always true and is now at least written down: for AI and
// biotech this series is a fixed-size sample of a much larger corpus, not a
// census, so read its LEVEL as an index and its SHAPE as the signal. Only
// quantum's corpus is small enough for it to be a real total.
//
// scripts/backfill-trend.ts reconstructs against this same constant, which
// is what keeps a reconstruction comparable to a recorded run. If it ever
// does change, TrendPoint.windowCap makes the break self-describing and
// loadHistory() segments the series automatically — that machinery is why
// changing it is survivable, not a reason to change it.
export const LIVE_WINDOW_CAP = 600;

// What windowCap-less points were recorded at. Every trend point written
// before that field existed used this ceiling, so absence means 600 rather
// than "unknown" — see loadHistory() in aggregate.ts.
export const LEGACY_WINDOW_CAP = 600;

export interface OpenAlexOpts {
  filter: string; // raw OpenAlex filter fragment, e.g. "topics.id:T10682" or "primary_topic.subfield.id:1702"
  key?: string; // OPENALEX_KEY — optional, raises the rate limit
  mailto?: string; // dead since OpenAlex dropped it 2026-02-13; ignored, still sent
  sinceDays?: number;
  n?: number; // per page — OpenAlex caps this at 200
  page?: number; // 1-indexed; use to page past the per-page cap
}

interface OAInstitution { country_code?: string | null; display_name?: string }
interface OAAuthorship {
  author?: { display_name?: string };
  institutions?: OAInstitution[];
  raw_affiliation_strings?: string[];
}
interface OAWork {
  id?: string; doi?: string | null; title?: string | null;
  display_name?: string | null; publication_date?: string | null;
  authorships?: OAAuthorship[];
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
  primary_location?: { source?: { display_name?: string | null } | null };
}

// OpenAlex returns abstracts as an inverted index (word -> the positions it
// appears at) rather than plain text — real data, just a different shape,
// reconstructed here rather than fetched from a second endpoint. The index
// already gives every word's exact slot, so this places words directly by
// position (O(n)) instead of collecting pairs and sorting (O(n log n)) —
// runs per work, on every live refresh as well as the nightly build.
function reconstructAbstract(inverted?: Record<string, number[]>): string | undefined {
  if (!inverted) return undefined;
  let maxPos = -1;
  for (const positions of Object.values(inverted)) for (const p of positions) if (p > maxPos) maxPos = p;
  if (maxPos < 0) return undefined;
  const words = new Array<string>(maxPos + 1);
  for (const [word, positions] of Object.entries(inverted)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(" ");
}

// Modal (most-represented) string in a list, breaking ties by first
// occurrence, applied to institution names/countries so "org"/"country"
// reflect where the work mostly came from rather than whichever author
// happened to be listed first.
function modalString(values: string[]): string | null {
  if (values.length === 0) return null;
  const tally = new Map<string, number>();
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Raw affiliation strings are typically "Institution Name, City, ST,
// Country. email@..." — the institution name is reliably the first comma
// segment. Used only when OpenAlex has no structured institution match;
// this is a text heuristic, not a lookup, so it stays out of the "live"
// provenance tier.
function orgFromRawAffiliation(raw: string): string {
  return raw.split(",")[0].replace(/\.$/, "").trim();
}

// A supplied OPENALEX_KEY that OpenAlex rejects must not take the innovation
// stage down with it. Every source in this app fails soft, so a bad key
// wouldn't raise an alarm — it would just stop all four verticals' papers
// from growing, quietly, in exactly the way an unset EPO_KEY hid for 45 days
// (see CLAUDE.md's EPO note). OpenAlex is the one source every vertical's
// innovation stage depends on, so an auth-class rejection drops the key and
// carries on rather than failing the fetch outright.
//
// Be clear about what the fallback actually buys, because an earlier version
// of this comment was wrong about it. OpenAlex ended the polite pool on
// 2026-02-13 and removed the `mailto` parameter with it — their own
// announcement is blunt, "No more polite pool! No more email parameter in
// your calls—it was never secure and couldn't scale. Keys only from here on
// out." Keyless now means "100 free credits for testing, then 409 errors."
// So this fallback is a trickle that salvages the first pages of a run, NOT
// a working steady state. It exists so a rotated or mistyped key costs some
// coverage instead of the whole stage, and the warning says so out loud
// rather than reading as an all-clear.
//
// `mailto` is still sent because it is now simply ignored, and dropping it
// would touch every call site for no gain. It grants nothing.
//
// The flag is module-level on purpose: one rejection converts the rest of the
// run, instead of re-spending a 403 on each of the ~200 paged calls a full
// four-vertical fetch makes.
let keyRejected = false;

async function oaFetch(baseUrl: string, mailto: string, key: string): Promise<Response> {
  const useKey = Boolean(key) && !keyRejected;
  const headers = { "User-Agent": `GlobalTechMonitor/0.2 (mailto:${mailto})` };

  const res = await fetch(baseUrl + (useKey ? `&api_key=${key}` : ""), { headers });
  if (res.ok) return res;

  if (useKey && (res.status === 401 || res.status === 403)) {
    keyRejected = true;
    console.warn(
      `OpenAlex rejected OPENALEX_KEY (HTTP ${res.status}) - continuing KEYLESS for the ` +
        `rest of this run. This is degraded, not fine: OpenAlex ended the polite pool on ` +
        `2026-02-13, so keyless is ~100 credits then HTTP 409. Expect partial coverage ` +
        `until the key is fixed.`,
    );
    const retry = await fetch(baseUrl, { headers });
    if (retry.ok) return retry;
    throw new Error(`OpenAlex HTTP ${retry.status}`);
  }

  throw new Error(`OpenAlex HTTP ${res.status}`);
}

// Shared by every OpenAlex fetch path (recent-window, top-cited-by-year) —
// one implementation of "raw OAWork -> real Entry" so institution/country
// resolution and abstract reconstruction can't drift between them.
function mapWork(w: OAWork): Entry {
  const title = (w.title ?? w.display_name ?? "").replace(/\s+/g, " ").trim();
  const abstractText = reconstructAbstract(w.abstract_inverted_index);
  const auths = w.authorships ?? [];

  const institutionNames: string[] = [];
  const countries: string[] = [];
  const rawAffiliations: string[] = [];
  const authorNames: string[] = [];
  for (const a of auths) {
    if (a.author?.display_name) authorNames.push(a.author.display_name);
    for (const i of a.institutions ?? []) {
      if (i.display_name) institutionNames.push(i.display_name);
      if (i.country_code) countries.push(i.country_code);
    }
    for (const raw of a.raw_affiliation_strings ?? []) if (raw) rawAffiliations.push(raw);
  }

  // Kept alongside the modal single-country collapse below, not instead of
  // it — every other panel reads `country`; this is purely additive, for
  // the real cross-border-collaboration signal (see collaboration.ts).
  const distinctCountries = [...new Set(countries)].sort();
  const collaboratingCountries = distinctCountries.length >= 2 ? distinctCountries : undefined;

  let org = modalString(institutionNames);
  let country = modalString(countries);
  let evidence = country
    ? `institution country codes [${countries.join(", ")}] → ${country}`
    : "no institution country on record";
  let provenance: Entry["provenance"] = "live";

  // No structured institution match — fall back to the raw affiliation
  // text OpenAlex still often carries even when it couldn't resolve a
  // formal institution record. Weaker signal, so this drops to "auto".
  if (!org && rawAffiliations.length > 0) {
    org = orgFromRawAffiliation(rawAffiliations[0]);
  }
  if (!country && rawAffiliations.length > 0) {
    const inferred = rawAffiliations
      .map((raw) => inferInstitutionCountry(raw).country)
      .filter((c): c is string => c !== null);
    const guess = modalString(inferred);
    if (guess) {
      country = guess;
      evidence = `inferred from raw affiliation text "${rawAffiliations[0]}" → ${guess}`;
      provenance = "auto";
    }
  }
  // Never fall back to an author's name as if it were an institution —
  // "Anonymous" or an individual researcher's name is not an org, and
  // showing it as one pollutes the institution leaderboard with what is
  // really just "no institution data available."
  org = org ?? "";

  const oaId = (w.id ?? "").split("/").pop() ?? title.slice(0, 40);
  const workUrl = w.doi ?? w.id ?? "https://openalex.org";
  return {
    id: `oa-${oaId}`, stage: "innovation", country, provenance,
    source: "paper", title, org, date: (w.publication_date ?? "").slice(0, 10),
    url: workUrl, countryEvidence: evidence,
    citations: w.cited_by_count,
    abstract: truncateAbstract(abstractText),
    authors: authorNames.length > 0 ? authorNames.slice(0, 6) : undefined,
    venue: w.primary_location?.source?.display_name ?? undefined,
    collaboratingCountries,
  };
}

export async function fetchOpenAlex(opts: OpenAlexOpts): Promise<Entry[]> {
  const { filter, key = "", mailto = "gtm@example.com", sinceDays = 30, n = 40, page = 1 } = opts;
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString().slice(0, 10);
  const url =
    "https://api.openalex.org/works" +
    "?filter=" +
    [
      filter,
      "primary_location.source.type:journal",
      `from_publication_date:${since}`,
    ].join(",") +
    "&sort=publication_date:desc" +
    `&per-page=${n}` +
    `&page=${page}` +
    `&mailto=${encodeURIComponent(mailto)}`;

  const res = await oaFetch(url, mailto, key);
  const json = (await res.json()) as { results?: OAWork[] };
  const works = json.results ?? [];
  if (works.length === 0) throw new Error("OpenAlex returned no results");

  return works.map(mapWork);
}

// Top-N most-cited works of the last `sinceYears` real years — a different
// question than fetchOpenAlex's rolling recent window, and needs its own
// query shape: sorted by citations (not recency), and restricted to
// `type:article` specifically. Confirmed by hand (2026-07-20): without
// that type restriction, OpenAlex's top hit for a quantum query was a
// journal-ISSUE-level record ("Communications in Computational Physics,"
// 509 "citations") masquerading as a work, not a real paper — `type:
// article` excludes it and every result after is a real article.
//
// Deliberately no per-year grouping (an earlier version fetched top-N
// PER year specifically to stop citations-accrue-over-time from letting
// the oldest year dominate a flat ranking) — removed 2026-07-20 at
// explicit request: a flat top-N by raw citation count across the whole
// window, accepting that older years will naturally rank higher. That's
// how "most cited" rankings work everywhere else too; the per-year
// grouping was this app's own choice, not a correctness requirement.
export async function fetchTopCited(opts: {
  filter: string; sinceYears: number; n: number; key?: string; mailto?: string; page?: number;
}): Promise<Entry[]> {
  const { filter, sinceYears, n, key = "", mailto = "gtm@example.com", page = 1 } = opts;
  const sinceYear = new Date().getFullYear() - sinceYears;
  const url =
    "https://api.openalex.org/works" +
    "?filter=" +
    [
      filter,
      "primary_location.source.type:journal",
      "type:article",
      `from_publication_date:${sinceYear}-01-01`,
    ].join(",") +
    "&sort=cited_by_count:desc" +
    `&per-page=${n}` +
    `&page=${page}` +
    `&mailto=${encodeURIComponent(mailto)}`;

  const res = await oaFetch(url, mailto, key);
  const json = (await res.json()) as { results?: OAWork[] };
  const works = json.results ?? [];
  return works.map(mapWork);
}

// Pages past OpenAlex's 200-per-page cap the same way fetchOpenAlexPages
// does, but for the citation-sorted query — `total` (e.g. 250) can exceed
// one page. Per-page size must stay IDENTICAL across pages for the offset
// math to line up; only the last page is allowed to come back short.
export async function fetchTopCitedPages(opts: {
  filter: string; sinceYears: number; total: number; perPage?: number; key?: string; mailto?: string;
}): Promise<Entry[]> {
  const { total, perPage = 200, ...rest } = opts;
  const pages = Math.ceil(total / perPage);
  const all: Entry[] = [];
  for (let page = 1; page <= pages; page++) {
    const batch = await fetchTopCited({ ...rest, n: perPage, page });
    all.push(...batch);
    if (batch.length < perPage) break; // fewer results than a full page — nothing more to fetch
  }
  return all.slice(0, total);
}

// Fetches multiple pages and concatenates — OpenAlex caps per-page at 200,
// so this is how a run gets more than that in one go. `n` here is the
// number of PAGES; each page is a full 200-item request. One implementation
// used by both the nightly build and the browser's live refresh, so paging
// behavior can't drift between them.
export async function fetchOpenAlexPages(opts: OpenAlexOpts & { pages?: number }): Promise<Entry[]> {
  const { pages = 1, ...rest } = opts;
  const byId = new Map<string, Entry>();
  for (let page = 1; page <= pages; page++) {
    try {
      const batch = await fetchOpenAlex({ ...rest, page });
      for (const e of batch) byId.set(e.id, e);
    } catch (err) {
      if (page === 1) throw err; // first page failing is a real failure
      break; // later pages can just run out of results — stop, keep what we have
    }
  }
  return [...byId.values()];
}
