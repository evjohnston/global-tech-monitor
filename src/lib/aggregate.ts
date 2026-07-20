import type { Entry, Stage, TrendPoint } from "./types.ts";
import { canonicalizeOrg } from "./entityResolution.ts";

// Count entries by country within a stage (or all stages). Open-ended —
// keyed by whatever real countries are actually present, not a fixed
// bucket set. Entries with no resolved country (country === null) are
// left out of this ranking; they still count toward stage/entry totals
// elsewhere, they just can't be attributed to a specific place.
export function countByCountry(entries: Entry[], stage?: Stage): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    if (!e.country) continue;
    out[e.country] = (out[e.country] ?? 0) + 1;
  }
  return out;
}

// Citation-weighted count by country — the ASPI "high-impact" idea. Falls
// back to raw counts when citation data is absent (arXiv/patent entries).
export function weightByCountry(entries: Entry[], stage?: Stage): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    if (!e.country) continue;
    out[e.country] = (out[e.country] ?? 0) + (e.citations ?? 0) + 1; // +1 so uncited work still counts
  }
  return out;
}

// Sum funding amounts by country (investment stage).
export function fundingByCountry(entries: Entry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.stage !== "investment" || !e.country) continue;
    out[e.country] = (out[e.country] ?? 0) + (e.amountUsd ?? 0);
  }
  return out;
}

export interface CountryCount { country: string; count: number }

// Ranks a country→count map and splits it into the top N (for compact views
// — chips, bar lists, KPIs) plus a "rest" total covering every other real
// country that showed up. Nothing is dropped or hidden; "rest" is a real
// sum a caller can label ("+N more countries"), not a discarded bucket.
export function topCountries(counts: Record<string, number>, n: number): { top: CountryCount[]; rest: CountryCount[] } {
  const sorted = Object.entries(counts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
  return { top: sorted.slice(0, n), rest: sorted.slice(n) };
}

export interface OrgRow {
  org: string;
  country: string | null;
  count: number;
}

// Institution leaderboard — who is publishing most, across a stage. Ranked
// by raw count. (Previously weighted by citations too, same idea as
// weightByCountry above — reverted 2026-07-20: checked the live AI-vertical
// build, every visible row read 0 citations, because OpenAlex's
// cited_by_count take real months to accrue and this corpus is days old.
// Ranking by a signal that's currently indistinguishable from zero, while
// also displaying it as if it were meaningful, is worse than not having it —
// see Leaderboard.tsx, which no longer shows the column either. Bring both
// back together once citations are non-trivial for a real slice of entries.)
//
// Groups by `orgId` (the canonical entity, see entityResolution.ts) rather
// than the raw `org` string, so "NVIDIA" and "Nvidia" — or "IBM Quantum" and
// "IBM Research - Zurich" — count as the one real institution they are,
// instead of splitting a leaderboard row three ways. Falls back to
// computing it on the fly for entries fetched before this field existed
// (fetch-data.ts stamps `orgId` at ingest for everything going forward).
export function orgLeaderboard(entries: Entry[], stage?: Stage, limit = 8): OrgRow[] {
  const map = new Map<string, OrgRow>();
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    if (!e.org) continue;
    const key = e.orgId ?? canonicalizeOrg(e.org).id;
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, { org: e.org, country: e.country, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}


// Count entries by stage, for the "entries by stage" breakdown panel.
export function countByStage(entries: Entry[]): Record<Stage, number> {
  const out: Record<Stage, number> = { innovation: 0, scaling: 0, adoption: 0, investment: 0 };
  for (const e of entries) out[e.stage]++;
  return out;
}

// Dated entries (day-granularity) in a stage, split into a trailing window
// and the window before it — real period-over-period deltas, computed from
// entry dates rather than invented. Coarse YYYY-MM seed entries parse to the
// 1st of the month, which is fine for a 21-day window comparison.
export function periodCounts(
  entries: Entry[],
  stage: Stage,
  windowDays: number,
  now = new Date()
): { current: number; previous: number } {
  const day = 86_400_000;
  const t = now.getTime();
  const cutCurrent = t - windowDays * day;
  const cutPrevious = t - 2 * windowDays * day;
  let current = 0;
  let previous = 0;
  for (const e of entries) {
    if (e.stage !== stage || !e.date) continue;
    const d = new Date(e.date).getTime();
    if (Number.isNaN(d)) continue;
    if (d >= cutCurrent) current++;
    else if (d >= cutPrevious) previous++;
  }
  return { current, previous };
}

export function periodFunding(
  entries: Entry[],
  windowDays: number,
  now = new Date()
): { current: number; previous: number } {
  const day = 86_400_000;
  const t = now.getTime();
  const cutCurrent = t - windowDays * day;
  const cutPrevious = t - 2 * windowDays * day;
  let current = 0;
  let previous = 0;
  for (const e of entries) {
    if (e.stage !== "investment" || !e.date) continue;
    const d = new Date(e.date).getTime();
    if (Number.isNaN(d)) continue;
    const amt = e.amountUsd ?? 0;
    if (d >= cutCurrent) current += amt;
    else if (d >= cutPrevious) previous += amt;
  }
  return { current, previous };
}

// Percent change, or null when there's no honest baseline to compare against
// rather than showing a misleading number — never "0%", never "N/A", the
// caller just omits the delta element entirely. `minBase` guards against a
// near-zero (not just zero) denominator — confirmed on real data
// (2026-07-20): the AI vertical's investment KPI had a trailing-21d
// previous-period count of 3, current of 324, rendering as "+10700.0%";
// its combined-stage total had a previous of 5, rendering "+32140.0%". A
// minBase of 10 didn't even catch those (previous of 3/5 is well under 10,
// but the live site still showed "+1212.1%" off a previous of ~50 for the
// same reason: this corpus is only ~6 days old, so *every* trailing-21d
// "previous" window is thin by construction, not just occasionally noisy).
// Raised to 30 for that reason — still a real division, but the audience
// here (policy analysts who'll cite this) should see no delta at all
// rather than a technically-real number computed off a window this young.
export function safeDelta(current: number, previous: number, minBase = 30): number | null {
  if (previous < minBase) return null;
  return ((current - previous) / previous) * 100;
}

// Share (%) of a country→count map, relative to the sum of every country in
// it — pass a pre-filtered map (e.g. just the top N) if you want shares
// relative to that subset rather than the whole world.
export function countryShares(counts: Record<string, number>): Record<string, number> {
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  return Object.fromEntries(Object.entries(counts).map(([c, n]) => [c, (n / total) * 100]));
}

// Count entries by country AND stage in one pass — feeds the stage-
// composition chart (each country's activity normalized to its own 100%
// across the four stages). Kept separate from countByCountry(entries, stage)
// called four times in a loop purely so the composition chart's data prep
// is one pass over entries, not four.
export function countByCountryAndStage(entries: Entry[]): Record<string, Record<Stage, number>> {
  const out: Record<string, Record<Stage, number>> = {};
  for (const e of entries) {
    if (!e.country) continue;
    const row = out[e.country] ?? (out[e.country] = { innovation: 0, scaling: 0, adoption: 0, investment: 0 });
    row[e.stage]++;
  }
  return out;
}

// All real recorded snapshots, oldest first — the substrate every trend/
// delta UI element should read from and gate on, rather than assuming
// history exists. Trend points recorded before 2026-07-20 lack the newer
// per-stage/funding fields (added then); callers that need those fields
// should filter on their presence rather than raw trend.length, since a
// handful of old points won't have them no matter how long trend[] is.
export function loadHistory(trend: TrendPoint[]): TrendPoint[] {
  return trend;
}
