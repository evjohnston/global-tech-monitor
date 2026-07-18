/**
 * Global Tech Monitor — data fetch
 *
 * Runs in Node (locally via `npm run fetch-data`, or daily on GitHub Actions).
 * Fetching here rather than in the browser is the whole point of the backend
 * layer: no CORS limits, and this is where patent scraping would slot in.
 *
 * Output: public/data.json — the app reads this at load, so the page is
 * instant and works as a static site.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { inferActor } from "../src/lib/inferActor.ts";
import type { DataFile, Entry } from "../src/lib/types.ts";
import { SEED } from "../data/seed.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data.json");
const TECH = "quantum-computing";
const ARXIV_MAX = 40;

const ARXIV_URL =
  "https://export.arxiv.org/api/query?search_query=cat:quant-ph" +
  `&sortBy=submittedDate&sortOrder=descending&max_results=${ARXIV_MAX}`;

interface ArxivAuthor {
  name: string;
  "arxiv:affiliation"?: string;
}
interface ArxivEntry {
  id: string;
  title: string;
  published: string;
  author: ArxivAuthor | ArxivAuthor[];
  link: { "@_rel"?: string; "@_href"?: string } | { "@_rel"?: string; "@_href"?: string }[];
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

async function fetchArxiv(): Promise<Entry[]> {
  const res = await fetch(ARXIV_URL, {
    headers: { "User-Agent": "GlobalTechMonitor/0.1 (research dashboard)" },
  });
  if (!res.ok) throw new Error(`arXiv HTTP ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml);
  const rawEntries = asArray<ArxivEntry>(parsed?.feed?.entry);

  return rawEntries.map((e): Entry => {
    const title = String(e.title ?? "").replace(/\s+/g, " ").trim();
    const authors = asArray(e.author);
    const names = authors.map((a) => a.name).filter(Boolean);
    const affils = authors
      .map((a) => a["arxiv:affiliation"] ?? "")
      .filter(Boolean)
      .join(" ");
    const orgLabel = names.length > 1 ? `${names[0]} et al.` : names[0] ?? "";
    const links = asArray(e.link);
    const alt = links.find((l) => l["@_rel"] === "alternate");
    const url = alt?.["@_href"] ?? e.id ?? "https://arxiv.org/list/quant-ph/recent";
    const { actor, evidence } = inferActor(`${affils} ${orgLabel} ${title}`);

    return {
      id: `arxiv-${e.id?.split("/abs/")[1] ?? title.slice(0, 40)}`,
      stage: "innovation",
      actor,
      provenance: "live",
      source: "arxiv",
      title,
      org: orgLabel,
      date: String(e.published ?? "").slice(0, 10),
      url,
      actorEvidence: evidence,
    };
  });
}

async function main() {
  let live: Entry[] = [];
  try {
    live = await fetchArxiv();
    console.log(`fetched ${live.length} arXiv entries`);
  } catch (err) {
    console.error("arXiv fetch failed:", (err as Error).message);
    console.error("writing seed-only data file so the app still renders");
  }

  // Dedupe by id, live entries win over any stale seed collision.
  const byId = new Map<string, Entry>();
  for (const e of [...SEED, ...live]) byId.set(e.id, e);

  const out: DataFile = {
    technology: TECH,
    generatedAt: new Date().toISOString(),
    entries: [...byId.values()],
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`wrote ${out.entries.length} entries → ${OUT}`);
}

main();
