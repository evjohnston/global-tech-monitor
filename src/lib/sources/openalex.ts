// OpenAlex works fetch — shared by the Node fetch script (scripts/fetch-data.ts),
// the Cloudflare Worker, and the browser's live-refresh path. Runtime-agnostic:
// only uses global fetch, so it runs unmodified in Node 20+, Workers, and browsers.
//
// Filters by OpenAlex's structured Topic "Quantum Computing Algorithms and
// Architecture" (T10682) restricted to journal-type sources, NOT by arXiv as
// primary location. Checked by hand before this was the query: filtering to
// arXiv-as-primary-location gave 0/50 works with ANY institution data (arXiv
// doesn't collect structured affiliations at submission, and OpenAlex mostly
// never backfills it for preprints — confirmed by sampling papers up to a
// year old, not just recent ones). The Topic+journal filter gives ~30-70% of
// works with real institution data in the same kind of sample (checked by
// hand, varies by date window). Trade-off: journal publication lags
// preprints, so this reads a few weeks to months behind the newest arXiv
// postings — the arXiv fallback below exists for when OpenAlex itself is
// unreachable, not as a "fresher" alternate feed.
import type { Entry } from "../types.ts";
import { inferInstitutionCountry } from "../institutionCountry.ts";

const TOPIC_QUANTUM_COMPUTING = "T10682";

export interface OpenAlexOpts {
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

export async function fetchOpenAlex(opts: OpenAlexOpts = {}): Promise<Entry[]> {
  const { key = "", mailto = "gtm@example.com", sinceDays = 30, n = 40, page = 1 } = opts;
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString().slice(0, 10);
  const url =
    "https://api.openalex.org/works" +
    "?filter=" +
    [
      `topics.id:${TOPIC_QUANTUM_COMPUTING}`,
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

  return works.map((w): Entry => {
    const title = (w.title ?? w.display_name ?? "").replace(/\s+/g, " ").trim();
    const auths = w.authorships ?? [];

    const institutionNames: string[] = [];
    const countries: string[] = [];
    const rawAffiliations: string[] = [];
    for (const a of auths) {
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
    };
  });
}

// Fetches multiple pages and concatenates — OpenAlex caps per-page at 200,
// so this is how a run gets more than that in one go. `n` here is the
// number of PAGES; each page is a full 200-item request. One implementation
// used by both the nightly build and the browser's live refresh, so paging
// behavior can't drift between them.
export async function fetchOpenAlexPages(opts: OpenAlexOpts & { pages?: number } = {}): Promise<Entry[]> {
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
