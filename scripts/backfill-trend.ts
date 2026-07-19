/**
 * One-time trend backfill — NOT part of the nightly fetch.
 *
 * The nightly build only ever appends ONE trend point (today's), so a fresh
 * or recently-reset data.json has almost no history and the trend/forecast
 * charts read as bare. This script does not invent that history: it fetches
 * a wide window of OpenAlex works (each with a real `publication_date`) once,
 * then for each of the past N days computes what a same-day fetch would
 * genuinely have counted — a rolling `sinceDays`-day window of real
 * publication dates, grouped by real country. Same math as the live query,
 * just run once per past day instead of once for today.
 *
 * Existing trend points win over backfilled ones for the same date (a real
 * recorded run is strictly better than a reconstruction), and days already
 * covered are left alone. Run with: npm run backfill-trend
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { fetchOpenAlexPages } from "../src/lib/sources/openalex.ts";
import type { DataFile, TrendPoint } from "../src/lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
// See scripts/fetch-data.ts for why this is needed when running via tsx directly.
config({ path: resolve(__dirname, "../.env.local") });
const OUT = resolve(__dirname, "../public/data.json");
const OA_KEY = process.env.OPENALEX_KEY ?? "";
const OA_MAILTO = process.env.OPENALEX_MAILTO ?? "gtm@example.com";

const BACKFILL_DAYS = 30; // how many past days to reconstruct
const ROLLING_WINDOW = 30; // matches the live query's sinceDays, so each
// reconstructed point is directly comparable to a real same-day fetch
const FETCH_WINDOW = BACKFILL_DAYS + ROLLING_WINDOW; // need works back this far

async function main() {
  if (!existsSync(OUT)) throw new Error(`${OUT} doesn't exist — run npm run fetch-data first`);
  const data = JSON.parse(readFileSync(OUT, "utf8")) as DataFile;

  console.log(`fetching ${FETCH_WINDOW}-day window of OpenAlex works...`);
  const works = await fetchOpenAlexPages({
    key: OA_KEY, mailto: OA_MAILTO, sinceDays: FETCH_WINDOW, n: 200, pages: 8,
  });
  console.log(`fetched ${works.length} works with real publication dates`);

  // Discard any point shaped like the pre-refactor us/cn/eu/other bucket
  // model (a leftover from before Entry.country replaced Entry.actor) —
  // real country codes are never lowercase, so this is an unambiguous tell.
  const isLegacyBucketPoint = (p: TrendPoint) =>
    Object.keys(p.counts).some((k) => ["us", "cn", "eu", "other"].includes(k));
  const validExisting = data.trend.filter((p) => !isLegacyBucketPoint(p));
  if (validExisting.length !== data.trend.length) {
    console.log(`dropped ${data.trend.length - validExisting.length} legacy actor-bucket trend point(s)`);
  }
  const existingByDate = new Map(validExisting.map((p) => [p.date, p]));
  const backfilled: TrendPoint[] = [];
  const now = Date.now();
  const DAY = 86_400_000;

  for (let daysAgo = BACKFILL_DAYS; daysAgo >= 0; daysAgo--) {
    const asOf = now - daysAgo * DAY;
    const date = new Date(asOf).toISOString().slice(0, 10);
    if (existingByDate.has(date)) continue; // a real recorded run wins

    const windowStart = asOf - ROLLING_WINDOW * DAY;
    const counts: Record<string, number> = {};
    for (const w of works) {
      if (!w.country) continue;
      const pub = new Date(w.date).getTime();
      if (Number.isNaN(pub) || pub < windowStart || pub > asOf) continue;
      counts[w.country] = (counts[w.country] ?? 0) + 1;
    }
    if (Object.values(counts).reduce((s, n) => s + n, 0) === 0) continue; // nothing real to record
    backfilled.push({ date, counts });
  }

  console.log(`reconstructed ${backfilled.length} historical points (${data.trend.length} already real)`);
  const merged = [...validExisting, ...backfilled].sort((a, b) => (a.date < b.date ? -1 : 1));
  data.trend = merged;

  writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`wrote ${merged.length} total trend points → ${OUT}`);
}

main();
