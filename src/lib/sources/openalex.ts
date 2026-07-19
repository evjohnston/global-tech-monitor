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
// year old, not just recent ones). The Topic+journal filter gives ~68% of
// works with real institution data in the same kind of sample. Trade-off:
// journal publication lags preprints, so this reads a few weeks to months
// behind the newest arXiv postings — the arXiv fallback below exists for
// when OpenAlex itself is unreachable, not as a "fresher" alternate feed.
import type { Entry } from "../types.ts";

const TOPIC_QUANTUM_COMPUTING = "T10682";

export interface OpenAlexOpts {
  key?: string; // OPENALEX_KEY — optional, raises the rate limit
  mailto?: string; // polite pool — identifies the caller to OpenAlex
  sinceDays?: number;
  n?: number;
}

interface OAInstitution { country_code?: string | null; display_name?: string }
interface OAAuthorship { author?: { display_name?: string }; institutions?: OAInstitution[] }
interface OAWork {
  id?: string; doi?: string | null; title?: string | null;
  display_name?: string | null; publication_date?: string | null;
  authorships?: OAAuthorship[];
}

// Modal (most-represented) string in a list, breaking ties by first
// occurrence — same logic actorFromCountries uses for country, applied here
// to institution names so "org" reflects where the work mostly came from
// rather than whichever author happened to be listed first.
function modalString(values: string[]): string | null {
  if (values.length === 0) return null;
  const tally = new Map<string, number>();
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export async function fetchOpenAlex(opts: OpenAlexOpts = {}): Promise<Entry[]> {
  const { key = "", mailto = "gtm@example.com", sinceDays = 30, n = 40 } = opts;
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
    const names = auths.map((a) => a.author?.display_name ?? "").filter(Boolean);

    const institutionNames: string[] = [];
    const countries: string[] = [];
    for (const a of auths) {
      for (const i of a.institutions ?? []) {
        if (i.display_name) institutionNames.push(i.display_name);
        if (i.country_code) countries.push(i.country_code);
      }
    }
    // org = the institution most of the authors share, not an author's name.
    // Falls back to "<author> et al." only when OpenAlex truly has no
    // institution on record for this work.
    const org = modalString(institutionNames) ?? (names.length > 1 ? `${names[0]} et al.` : names[0] ?? "");

    // country = the country most of the authors' institutions share.
    // modalString's stable sort ties toward first-seen, which in practice
    // means the first author's country when there's a tie — no separate
    // tie-break needed.
    const country = modalString(countries);
    const evidence = country
      ? `institution country codes [${countries.join(", ")}] → ${country}`
      : "no institution country on record";
    const oaId = (w.id ?? "").split("/").pop() ?? title.slice(0, 40);
    const workUrl = w.doi ?? w.id ?? "https://openalex.org";
    return {
      id: `oa-${oaId}`, stage: "innovation", country, provenance: "live",
      source: "paper", title, org, date: (w.publication_date ?? "").slice(0, 10),
      url: workUrl, countryEvidence: evidence,
    };
  });
}
