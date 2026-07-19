import type { Entry, Stage, TrendPoint } from "./types.ts";

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

// Institution leaderboard — who is publishing most, across a stage.
export function orgLeaderboard(entries: Entry[], stage?: Stage, limit = 8): OrgRow[] {
  const map = new Map<string, OrgRow>();
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    if (!e.org) continue;
    const key = e.org;
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
// (zero previous-period activity) rather than showing a misleading number.
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Share (%) of a country→count map, relative to the sum of every country in
// it — pass a pre-filtered map (e.g. just the top N) if you want shares
// relative to that subset rather than the whole world.
export function countryShares(counts: Record<string, number>): Record<string, number> {
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  return Object.fromEntries(Object.entries(counts).map(([c, n]) => [c, (n / total) * 100]));
}

export interface ProjectedSeries {
  country: string;
  points: number[]; // future share-percent points, one per projected step
}

// Linear extrapolation of each given country's share of innovation-stage
// trend points. Needs at least 3 recorded days to be worth showing —
// anything thinner is a projection built on noise, not a trend. Labeled as
// a projection wherever it's rendered, never presented as measured data.
// `countries` should be a small caller-chosen set (e.g. top 4-5 by current
// volume) — projecting every country ever seen would be an unreadable
// tangle of lines, not a decision this function should make on its own.
export function projectCountryShares(trend: TrendPoint[], countries: string[], steps = 4): ProjectedSeries[] | null {
  if (trend.length < 3 || countries.length === 0) return null;
  const n = trend.length;
  const shareSeries: Record<string, number[]> = {};
  for (const c of countries) shareSeries[c] = [];
  for (const p of trend) {
    const total = Object.values(p.counts).reduce((s, v) => s + v, 0) || 1;
    for (const c of countries) shareSeries[c].push(((p.counts[c] ?? 0) / total) * 100);
  }
  function fit(ys: number[]): (x: number) => number {
    const xs = ys.map((_, i) => i);
    const xbar = xs.reduce((s, x) => s + x, 0) / n;
    const ybar = ys.reduce((s, y) => s + y, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xbar) * (ys[i] - ybar);
      den += (xs[i] - xbar) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = ybar - slope * xbar;
    return (x: number) => intercept + slope * x;
  }
  return countries.map((c) => {
    const f = fit(shareSeries[c]);
    const points = Array.from({ length: steps }, (_, i) => Math.max(0, Math.min(100, f(n - 1 + i + 1))));
    return { country: c, points };
  });
}
