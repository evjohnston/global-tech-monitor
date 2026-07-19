/**
 * Global Tech Monitor — one-time entry backfill
 *
 * scripts/fetch-data.ts deliberately keeps OpenAlex/NSF windows narrow (a
 * rolling 30-day OpenAlex window, NSF_N=300) so the nightly build stays fast
 * and trend[] keeps a consistent rolling-window meaning (see
 * scripts/backfill-trend.ts for why that matters). This script is the
 * entries-side equivalent: a ONE-TIME deeper pull — a 2-year OpenAlex window
 * and a much larger NSF batch — merged into the existing public/data.json
 * to seed a realistic starting volume, without touching trend[] or changing
 * the nightly script's own windows.
 *
 * Real data only, same shared src/lib/sources/* modules as every other
 * fetch path in this app — this is not fabricated volume, just a deeper
 * pull of what already exists at OpenAlex/NSF.
 *
 * Run again any time you want another one-off top-up: `npm run backfill-entries`.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DataFile, Entry } from "../src/lib/types.ts";
import { fetchOpenAlexPages } from "../src/lib/sources/openalex.ts";
import { fetchNSF } from "../src/lib/sources/nsf.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data.json");

const OA_KEY = process.env.OPENALEX_KEY ?? "";
const OA_MAILTO = process.env.OPENALEX_MAILTO ?? "gtm@example.com";

async function main() {
  const prev = JSON.parse(readFileSync(OUT, "utf8")) as DataFile;
  const byId = new Map<string, Entry>();
  for (const e of prev.entries) byId.set(e.id, e);
  const before = byId.size;

  console.log("Fetching OpenAlex 2-year historical window (paged)...");
  const oa = await fetchOpenAlexPages({
    key: OA_KEY, mailto: OA_MAILTO, sinceDays: 730, n: 200, pages: 25,
  });
  let oaNew = 0;
  for (const e of oa) { if (!byId.has(e.id)) oaNew++; byId.set(e.id, e); }
  console.log(`OpenAlex: ${oa.length} works fetched, ${oaNew} new`);

  console.log("Fetching NSF historical batch...");
  const nsf = await fetchNSF(2000);
  let nsfNew = 0;
  for (const e of nsf) { if (!byId.has(e.id)) nsfNew++; byId.set(e.id, e); }
  console.log(`NSF: ${nsf.length} awards fetched, ${nsfNew} new`);

  const out: DataFile = { ...prev, entries: [...byId.values()] };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`entries: ${before} -> ${out.entries.length}`);
}

main();
