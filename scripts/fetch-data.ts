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
import { actorFromCountries, actorFromCountry } from "../src/lib/actorFromCountry.ts";
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

// EPO Open Patent Services — free tier, needs a key (OAuth2 client creds).
// Set EPO_KEY and EPO_SECRET as GitHub secrets. Patents carry country data
// but lag ~18 months, so this is a slow-moving signal by nature.
const EPO_KEY = process.env.EPO_KEY ?? "";
const EPO_SECRET = process.env.EPO_SECRET ?? "";

// NSF Awards API — public, no key. US research funding. There is no
// equivalent public machine-readable feed for China's NSFC, so the funding
// view is structurally weighted toward US/EU. We label this in the UI.
const NSF_URL =
  "https://www.research.gov/awardapi-service/v1/awards.json" +
  "?keyword=quantum" +
  "&printFields=id,title,awardeeName,awardeeCountryCode,fundsObligatedAmt,startDate" +
  `&rpp=${N}`;

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// ── NSF funding (investment stage) ────────────────────────────────
interface NSFAward {
  id?: string; title?: string; awardeeName?: string;
  awardeeCountryCode?: string; fundsObligatedAmt?: string; startDate?: string;
}
async function fetchNSF(): Promise<Entry[]> {
  const res = await fetch(NSF_URL, {
    headers: { "User-Agent": "GlobalTechMonitor/0.3" },
  });
  if (!res.ok) throw new Error(`NSF HTTP ${res.status}`);
  const json = (await res.json()) as { response?: { award?: NSFAward[] } };
  const awards = json.response?.award ?? [];
  return awards.map((a): Entry => {
    const amt = Number(a.fundsObligatedAmt ?? 0) || undefined;
    const d = a.startDate ?? ""; // MM/DD/YYYY → ISO
    const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(d)
      ? `${d.slice(6, 10)}-${d.slice(0, 2)}-${d.slice(3, 5)}` : d.slice(0, 10);
    return {
      id: `nsf-${a.id ?? Math.random().toString(36).slice(2)}`,
      stage: "investment",
      actor: actorFromCountry(a.awardeeCountryCode ?? "US"),
      provenance: "live", source: "grant",
      title: (a.title ?? "").replace(/\s+/g, " ").trim(),
      org: a.awardeeName ?? "", date: iso,
      url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${a.id ?? ""}`,
      amountUsd: amt,
      actorEvidence: `NSF awardee country ${a.awardeeCountryCode ?? "US"}`,
    };
  });
}

// ── EPO patents (innovation stage) ────────────────────────────────
async function fetchPatents(): Promise<Entry[]> {
  if (!EPO_KEY || !EPO_SECRET) throw new Error("EPO key/secret not set");
  // OAuth2 client-credentials token.
  const tokenRes = await fetch("https://ops.epo.org/3.2/auth/accesstoken", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${EPO_KEY}:${EPO_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) throw new Error(`EPO auth HTTP ${tokenRes.status}`);
  const token = ((await tokenRes.json()) as { access_token?: string }).access_token;
  // CPC G06N10 = quantum computing. Published-data search, newest first.
  const searchRes = await fetch(
    "https://ops.epo.org/3.2/rest-services/published-data/search/biblio" +
      `?q=cpc%3DG06N10&Range=1-${N}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  if (!searchRes.ok) throw new Error(`EPO search HTTP ${searchRes.status}`);
  const data = (await searchRes.json()) as any;
  const docs = asArray(
    data?.["ops:world-patent-data"]?.["ops:biblio-search"]?.["ops:search-result"]?.["exchange-documents"]
  );
  return docs.slice(0, N).map((d: any, i: number): Entry => {
    const ex = d?.["exchange-document"] ?? {};
    const country = ex?.["@country"] ?? "";
    const titleNode = ex?.["bibliographic-data"]?.["invention-title"];
    const title = Array.isArray(titleNode)
      ? (titleNode.find((t: any) => t?.["@lang"] === "en")?.["$"] ?? titleNode[0]?.["$"] ?? "")
      : titleNode?.["$"] ?? "Patent filing";
    const num = `${country}${ex?.["@doc-number"] ?? i}`;
    return {
      id: `epo-${num}`, stage: "innovation",
      actor: actorFromCountry(country), provenance: "live", source: "patent",
      title: String(title).replace(/\s+/g, " ").trim() || "Quantum computing patent",
      org: `${country} filing`, date: "",
      url: `https://worldwide.espacenet.com/patent/search?q=${num}`,
      actorEvidence: `EPO filing country ${country}`,
    };
  });
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

  // Patents and funding are additive and each fails soft — a missing key or
  // a down endpoint drops that source without breaking the build.
  let patents: Entry[] = [];
  try {
    patents = await fetchPatents();
    console.log(`EPO: ${patents.length} patents`);
  } catch (err) {
    console.error("patents skipped:", (err as Error).message);
  }
  let funding: Entry[] = [];
  try {
    funding = await fetchNSF();
    console.log(`NSF: ${funding.length} grants`);
  } catch (err) {
    console.error("funding skipped:", (err as Error).message);
  }

  const byId = new Map<string, Entry>();
  for (const e of [...SEED, ...live, ...patents, ...funding]) byId.set(e.id, e);

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
