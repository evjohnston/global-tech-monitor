/**
 * Global Tech Monitor — data fetch
 *
 * Runs in Node (locally via `npm run fetch-data`, or daily on GitHub Actions).
 *
 * Sources:
 *   - OpenAlex for innovation-stage works WITH institution country codes.
 *     This is what makes actor attribution real rather than a keyword guess.
 *     Falls back to arXiv (no affiliations) if OpenAlex is unreachable or the
 *     key is missing, so the build never fails hard.
 *   - data/seed.ts for scaling/adoption (no clean live feed).
 *   - data/notes.ts for the analyst "so what" layer.
 *
 * Accumulation:
 *   Reads the PREVIOUS public/data.json and appends one trend point per run,
 *   so actor-share history builds up over time instead of being overwritten.
 *
 * Output: public/data.json — the app reads this at load.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { actorFromCountries } from "../src/lib/actorFromCountry.ts";
import { inferActor } from "../src/lib/inferActor.ts";
import type { Actor, DataFile, Entry, TrendPoint } from "../src/lib/types.ts";
import { SEED } from "../data/seed.ts";
import { NOTES } from "../data/notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data.json");
const TECH = "quantum-computing";
const N = 40;

// OpenAlex quant-ph concept + recency. The mailto/key are read from env; the
// key is optional but recommended (set OPENALEX_KEY as a GitHub secret).
const OA_KEY = process.env.OPENALEX_KEY ?? "";
const OA_MAILTO = process.env.OPENALEX_MAILTO ?? "gtm@example.com";
// Filter by arXiv quant-ph as the primary location, which is exact and
// doesn't depend on a memorized concept ID. arXiv's OpenAlex source id is
// S4306400194. We also require recency so the daily run stays fresh.
const OA_SINCE = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
const OA_URL =
  "https://api.openalex.org/works" +
  "?filter=" +
  [
    "primary_location.source.id:S4306400194", // arXiv
    "title_and_abstract.search:quantum",
    `from_publication_date:${OA_SINCE}`,
  ].join(",") +
  "&sort=publication_date:desc" +
  `&per-page=${N}` +
  `&mailto=${encodeURIComponent(OA_MAILTO)}` +
  (OA_KEY ? `&api_key=${OA_KEY}` : "");

const ARXIV_URL =
  "https://export.arxiv.org/api/query?search_query=cat:quant-ph" +
  `&sortBy=submittedDate&sortOrder=descending&max_results=${N}`;

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// ── OpenAlex path (preferred: has country codes) ──────────────────
interface OAInstitution { country_code?: string | null; display_name?: string }
interface OAAuthorship { author?: { display_name?: string }; institutions?: OAInstitution[] }
interface OAWork {
  id?: string; doi?: string | null; title?: string | null;
  display_name?: string | null; publication_date?: string | null;
  authorships?: OAAuthorship[];
}

async function fetchOpenAlex(): Promise<Entry[]> {
  const res = await fetch(OA_URL, {
    headers: { "User-Agent": `GlobalTechMonitor/0.2 (mailto:${OA_MAILTO})` },
  });
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
    const url = w.doi ?? w.id ?? "https://openalex.org";
    return {
      id: `oa-${oaId}`, stage: "innovation", actor, provenance: "live",
      source: "arxiv", title, org, date: (w.publication_date ?? "").slice(0, 10),
      url, actorEvidence: evidence,
    };
  });
}

// ── arXiv fallback (no country codes → keyword inference) ─────────
async function fetchArxiv(): Promise<Entry[]> {
  const res = await fetch(ARXIV_URL, {
    headers: { "User-Agent": "GlobalTechMonitor/0.2 (research dashboard)" },
  });
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
    const url = alt?.["@_href"] ?? e.id ?? "https://arxiv.org/list/quant-ph/recent";
    const { actor, evidence } = inferActor(`${org} ${title}`);
    return {
      id: `arxiv-${String(e.id ?? "").split("/abs/")[1] ?? title.slice(0, 40)}`,
      stage: "innovation", actor, provenance: "live", source: "arxiv",
      title, org, date: String(e.published ?? "").slice(0, 10), url,
      actorEvidence: `${evidence} (arXiv fallback, no country data)`,
    };
  });
}

function readPrevious(): DataFile | null {
  if (!existsSync(OUT)) return null;
  try { return JSON.parse(readFileSync(OUT, "utf8")) as DataFile; }
  catch { return null; }
}

function trendPoint(live: Entry[]): TrendPoint {
  const counts: Record<Actor, number> = { us: 0, cn: 0, eu: 0, other: 0 };
  for (const e of live) if (e.stage === "innovation") counts[e.actor]++;
  return { date: new Date().toISOString().slice(0, 10), counts };
}

async function main() {
  let live: Entry[] = [];
  let sourceUsed = "openalex";
  try {
    live = await fetchOpenAlex();
    console.log(`OpenAlex: ${live.length} works with country attribution`);
  } catch (err) {
    console.error("OpenAlex failed:", (err as Error).message);
    try {
      live = await fetchArxiv();
      sourceUsed = "arxiv-fallback";
      console.log(`arXiv fallback: ${live.length} works (no country data)`);
    } catch (err2) {
      console.error("arXiv also failed:", (err2 as Error).message);
      sourceUsed = "seed-only";
    }
  }

  const prev = readPrevious();
  const byId = new Map<string, Entry>();
  for (const e of [...SEED, ...live]) byId.set(e.id, e);

  // Append today's trend point, keeping prior history. One point per date.
  const history = (prev?.trend ?? []).filter(
    (p) => p.date !== new Date().toISOString().slice(0, 10)
  );
  const trend = live.length > 0 ? [...history, trendPoint(live)] : history;

  const out: DataFile = {
    technology: TECH,
    generatedAt: new Date().toISOString(),
    entries: [...byId.values()],
    trend,
    notes: NOTES,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(
    `wrote ${out.entries.length} entries, ${trend.length} trend points ` +
    `(source: ${sourceUsed}) → ${OUT}`
  );
}

main();
