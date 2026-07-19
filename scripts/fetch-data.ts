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
import { inferActor } from "../src/lib/inferActor.ts";
import type { Actor, DataFile, Entry, TrendPoint } from "../src/lib/types.ts";
import { fetchOpenAlex } from "../src/lib/sources/openalex.ts";
import { fetchPatents } from "../src/lib/sources/epo.ts";
import { fetchNSF } from "../src/lib/sources/nsf.ts";
import { asArray } from "../src/lib/sources/util.ts";
import { SEED } from "../data/seed.ts";
import { NOTES } from "../data/notes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data.json");
const TECH = "quantum-computing";

// Per-request caps, one per source — each API has a different real ceiling,
// checked by hand before picking these: OpenAlex's per-page max is 200
// (confirmed; ~3,178 arXiv works actually matched the 21-day window when
// this was checked, so 200 is real recent volume, not a stretch), NSF's
// awardapi accepts rpp up to at least 100 (confirmed), EPO OPS search caps
// around 100 per request on the free tier (per their docs — untested here,
// no key yet).
const OA_N = 200;
const NSF_N = 100;
const EPO_N = 100;

// OpenAlex quant-ph, EPO patents, and NSF grants are all fetched through the
// shared src/lib/sources/* modules — the same code the Cloudflare Worker uses
// for live browser reads (worker/src/index.ts), so attribution logic never
// drifts between the nightly build and the live path.
const OA_KEY = process.env.OPENALEX_KEY ?? "";
const OA_MAILTO = process.env.OPENALEX_MAILTO ?? "gtm@example.com";
const EPO_KEY = process.env.EPO_KEY ?? "";
const EPO_SECRET = process.env.EPO_SECRET ?? "";

const ARXIV_URL =
  "https://export.arxiv.org/api/query?search_query=cat:quant-ph" +
  `&sortBy=submittedDate&sortOrder=descending&max_results=${OA_N}`;

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
    live = await fetchOpenAlex({ key: OA_KEY, mailto: OA_MAILTO, sinceDays: 21, n: OA_N });
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
    patents = await fetchPatents(EPO_KEY, EPO_SECRET, EPO_N);
    console.log(`EPO: ${patents.length} patents`);
  } catch (err) {
    console.error("patents skipped:", (err as Error).message);
  }
  let funding: Entry[] = [];
  try {
    funding = await fetchNSF(NSF_N);
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
