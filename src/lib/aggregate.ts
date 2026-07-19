import type { Actor, Entry, Stage, TrendPoint } from "./types.ts";
import { ACTORS } from "./types.ts";

const ACTOR_ORDER: Actor[] = ["us", "cn", "eu", "other"];

// Count entries by actor within a stage (or all stages).
export function countByActor(entries: Entry[], stage?: Stage): Record<Actor, number> {
  const out: Record<Actor, number> = { us: 0, cn: 0, eu: 0, other: 0 };
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    out[e.actor]++;
  }
  return out;
}

// Citation-weighted share by actor — the ASPI "high-impact" idea. Falls back
// to raw counts when citation data is absent (arXiv/patent entries).
export function weightByActor(entries: Entry[], stage?: Stage): Record<Actor, number> {
  const out: Record<Actor, number> = { us: 0, cn: 0, eu: 0, other: 0 };
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    out[e.actor] += (e.citations ?? 0) + 1; // +1 so uncited work still counts
  }
  return out;
}

// Sum funding amounts by actor (investment stage).
export function fundingByActor(entries: Entry[]): Record<Actor, number> {
  const out: Record<Actor, number> = { us: 0, cn: 0, eu: 0, other: 0 };
  for (const e of entries) {
    if (e.stage !== "investment") continue;
    out[e.actor] += e.amountUsd ?? 0;
  }
  return out;
}

export interface OrgRow {
  org: string;
  actor: Actor;
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
    else map.set(key, { org: e.org, actor: e.actor, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export const ACTOR_LABEL: Record<Actor, string> = Object.fromEntries(
  ACTORS.map((a) => [a.id, a.label])
) as Record<Actor, string>;

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

export function actorShares(counts: Record<Actor, number>): Record<Actor, number> {
  const total = ACTOR_ORDER.reduce((s, a) => s + counts[a], 0) || 1;
  return Object.fromEntries(ACTOR_ORDER.map((a) => [a, (counts[a] / total) * 100])) as Record<Actor, number>;
}

export interface ProjectedSeries {
  actor: Actor;
  points: number[]; // future share-percent points, one per projected step
}

// Linear extrapolation of each actor's share of innovation-stage trend
// points. Needs at least 3 recorded days to be worth showing — anything
// thinner is a projection built on noise, not a trend. Labeled as a
// projection wherever it's rendered, never presented as measured data.
export function projectShares(trend: TrendPoint[], steps = 4): ProjectedSeries[] | null {
  if (trend.length < 3) return null;
  const n = trend.length;
  const shareSeries: Record<Actor, number[]> = { us: [], cn: [], eu: [], other: [] };
  for (const p of trend) {
    const total = ACTOR_ORDER.reduce((s, a) => s + p.counts[a], 0) || 1;
    for (const a of ACTOR_ORDER) shareSeries[a].push((p.counts[a] / total) * 100);
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
  return ACTOR_ORDER.map((a) => {
    const f = fit(shareSeries[a]);
    const points = Array.from({ length: steps }, (_, i) => Math.max(0, Math.min(100, f(n - 1 + i + 1))));
    return { actor: a, points };
  });
}
