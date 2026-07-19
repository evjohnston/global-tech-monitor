// OpenAlex works fetch — shared by the Node fetch script (scripts/fetch-data.ts),
// the Cloudflare Worker, and the browser's live-refresh path. Runtime-agnostic:
// only uses global fetch, so it runs unmodified in Node 20+, Workers, and browsers.
//
// Filters by arXiv quant-ph as the primary location, which is exact and doesn't
// depend on a memorized concept ID. arXiv's OpenAlex source id is S4306400194.
// Recency is required so a live/daily run stays fresh.
import { actorFromCountries } from "../actorFromCountry.ts";
import type { Entry } from "../types.ts";

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

export async function fetchOpenAlex(opts: OpenAlexOpts = {}): Promise<Entry[]> {
  const { key = "", mailto = "gtm@example.com", sinceDays = 21, n = 40 } = opts;
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString().slice(0, 10);
  const url =
    "https://api.openalex.org/works" +
    "?filter=" +
    [
      "primary_location.source.id:S4306400194", // arXiv
      "title_and_abstract.search:quantum",
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
    const org = names.length > 1 ? `${names[0]} et al.` : names[0] ?? "";
    const countries: string[] = [];
    for (const a of auths) for (const i of a.institutions ?? []) {
      if (i.country_code) countries.push(i.country_code);
    }
    const firstAuthorCountry =
      auths[0]?.institutions?.find((i) => i.country_code)?.country_code ?? null;
    const { actor, evidence } = actorFromCountries(countries, firstAuthorCountry);
    const oaId = (w.id ?? "").split("/").pop() ?? title.slice(0, 40);
    const workUrl = w.doi ?? w.id ?? "https://openalex.org";
    return {
      id: `oa-${oaId}`, stage: "innovation", actor, provenance: "live",
      source: "arxiv", title, org, date: (w.publication_date ?? "").slice(0, 10),
      url: workUrl, actorEvidence: evidence,
    };
  });
}
