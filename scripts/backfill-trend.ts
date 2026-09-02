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
 * covered are left alone.
 *
 * Run with: npm run backfill-trend -- <vertical-id>   (defaults to quantum-computing)
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { fetchOpenAlexPages, LIVE_WINDOW_CAP } from "../src/lib/sources/openalex.ts";
import type { DataFile, TrendPoint } from "../src/lib/types.ts";
import { verticalById } from "../src/lib/verticals.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
// See scripts/fetch-data.ts for why this is needed when running via tsx directly.
config({ path: resolve(__dirname, "../.env.local") });

const v = verticalById(process.argv[2] ?? "quantum-computing");
const OUT = resolve(__dirname, `../public/data/${v.id}.json`);
const OA_KEY = process.env.OPENALEX_KEY ?? "";
const OA_MAILTO = process.env.OPENALEX_MAILTO ?? "gtm@example.com";

const BACKFILL_DAYS = 30; // how many past days to reconstruct
const ROLLING_WINDOW = 30; // matches the live query's sinceDays, so each
// reconstructed point is directly comparable to a real same-day fetch
const FETCH_WINDOW = BACKFILL_DAYS + ROLLING_WINDOW; // need works back this far

async function main() {
  console.log(`backfilling trend for ${v.label} (${v.id})`);
  if (!existsSync(OUT)) throw new Error(`${OUT} doesn't exist — run npm run fetch-data first`);
  const data = JSON.parse(readFileSync(OUT, "utf8")) as DataFile;

  console.log(`fetching ${FETCH_WINDOW}-day window of OpenAlex works...`);
  const works = await fetchOpenAlexPages({
    // Matches fetch-data.ts's own OA_PAGES — a reconstruction has to be
    // able to reach the same ceiling the live query does, or the coverage
    // guard below correctly refuses every day.
    filter: v.openAlexFilter, key: OA_KEY, mailto: OA_MAILTO, sinceDays: FETCH_WINDOW, n: 200, pages: 50,
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
  // "A real recorded run beats a reconstruction" holds only when the two are
  // measuring the same thing. A point recorded at a DIFFERENT window ceiling
  // (see TrendPoint.windowCap) is not comparable to today's, so it doesn't
  // get to block a faithful reconstruction at the current one — otherwise
  // raising OA_PAGES would permanently freeze the old, incomparable points
  // in place and loadHistory() would simply discard them, leaving the
  // vertical with no history at all. Points at the current ceiling still
  // win, as before.
  const existingByDate = new Map(
    validExisting.filter((p) => p.windowCap === LIVE_WINDOW_CAP).map((p) => [p.date, p])
  );
  const supersededDates = new Set(
    validExisting.filter((p) => p.windowCap !== LIVE_WINDOW_CAP).map((p) => p.date)
  );
  const backfilled: TrendPoint[] = [];
  let skippedForCoverage = 0;
  const now = Date.now();
  const DAY = 86_400_000;

  for (let daysAgo = BACKFILL_DAYS; daysAgo >= 0; daysAgo--) {
    const asOf = now - daysAgo * DAY;
    const date = new Date(asOf).toISOString().slice(0, 10);
    if (existingByDate.has(date)) continue; // a real recorded run wins

    const windowStart = asOf - ROLLING_WINDOW * DAY;
    // Every work published inside that day's rolling window, newest first —
    // NOT yet counted, because a same-day live fetch would only ever have
    // SEEN the first LIVE_WINDOW_CAP of these (the live query sorts
    // publication_date:desc and stops at OA_N x OA_PAGES). Counting the
    // whole window instead is what produced the inflated leading points
    // this script used to write; see LIVE_WINDOW_CAP in openalex.ts.
    const inWindow = works
      .filter((w) => {
        const pub = new Date(w.date).getTime();
        return !Number.isNaN(pub) && pub >= windowStart && pub <= asOf;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    if (inWindow.length === 0) continue; // nothing real to record

    // Coverage guard. Truncating to the cap is only faithful if we actually
    // HAVE the cap's worth of works for this window — or, failing that, if
    // our fetch reaches back past the window's start, meaning we hold the
    // entire window and a live fetch would have seen all of it too. With
    // neither, this day is a partial sample masquerading as a count, so it
    // gets skipped rather than written. This is what stops a high-volume
    // vertical (biotechnology: ~9,800 journal works per 30 days, far past
    // any basic-paging fetch) from getting a fabricated ramp.
    const oldestFetched = Math.min(...works.map((w) => new Date(w.date).getTime()).filter((t) => !Number.isNaN(t)));
    const haveFullWindow = oldestFetched <= windowStart;
    if (inWindow.length < LIVE_WINDOW_CAP && !haveFullWindow) {
      skippedForCoverage++;
      continue;
    }

    const counts: Record<string, number> = {};
    for (const w of inWindow.slice(0, LIVE_WINDOW_CAP)) {
      if (!w.country) continue;
      counts[w.country] = (counts[w.country] ?? 0) + 1;
    }
    if (Object.values(counts).reduce((s, n) => s + n, 0) === 0) continue;
    backfilled.push({ date, counts, windowCap: LIVE_WINDOW_CAP });
  }

  console.log(`reconstructed ${backfilled.length} historical points (${data.trend.length} already real)`);
  if (skippedForCoverage > 0) {
    console.log(
      `skipped ${skippedForCoverage} day(s) for insufficient coverage — this fetch didn't reach back far ` +
      `enough to reconstruct them faithfully at the live query's own ${LIVE_WINDOW_CAP}-work cap. Real ` +
      `limitation of OpenAlex basic paging on a high-volume vertical, not a bug: those days are left to ` +
      `accumulate from real scheduled runs instead of being written as a partial sample.`
    );
  }
  // Drop a stale-ceiling point only where a reconstruction actually replaced
  // it. Where none could be built (the coverage guard refused), the old
  // point is left in the file untouched — loadHistory() won't chart it, but
  // deleting a real recorded observation to tidy up would be destroying
  // data to make a number look neater.
  const rebuilt = new Set(backfilled.map((p) => p.date));
  const kept = validExisting.filter((p) => !rebuilt.has(p.date));
  const replaced = [...supersededDates].filter((d) => rebuilt.has(d)).length;
  if (replaced > 0) console.log(`replaced ${replaced} point(s) recorded at a previous window ceiling`);
  const merged = [...kept, ...backfilled].sort((a, b) => (a.date < b.date ? -1 : 1));
  data.trend = merged;

  writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`wrote ${merged.length} total trend points → ${OUT}`);
}

main();
