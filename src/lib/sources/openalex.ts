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

export interface OpenAlexOpts {
  filter: string; // raw OpenAlex filter fragment, e.g. "topics.id:T10682" or "primary_topic.subfield.id:1702"
  key?: string; // OPENALEX_KEY — optional, raises the rate limit
  mailto?: string; // polite pool — identifies the caller to OpenAlex
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
    abstract: abstractText,
    authors: authorNames.length > 0 ? authorNames.slice(0, 6) : undefined,
    venue: w.primary_location?.source?.display_name ?? undefined,
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
    `&mailto=${encodeURIComponent(mailto)}` +
    (key ? `&api_key=${key}` : "");

  const res = await fetch(url, { headers: { "User-Agent": `GlobalTechMonitor/0.2 (mailto:${mailto})` } });
  if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
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
    `&mailto=${encodeURIComponent(mailto)}` +
    (key ? `&api_key=${key}` : "");

  const res = await fetch(url, { headers: { "User-Agent": `GlobalTechMonitor/0.2 (mailto:${mailto})` } });
  if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
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
