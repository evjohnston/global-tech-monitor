import type { Entry } from "./types.ts";
import { countByCountry, rankOf } from "./aggregate.ts";
import { entriesAsOf, daysAgo } from "./history.ts";

export type BumpMeasure = "publications" | "patents" | "scaling" | "adoption" | "investment";

export interface BumpSeries {
  country: string;
  ranks: (number | null)[]; // one per BumpData.dates entry, null where that country had no counted activity yet
}

export interface BumpData {
  dates: string[]; // ISO, oldest to newest
  series: BumpSeries[]; // top countries by CURRENT rank for this measure
}

const BUMP_WINDOW_DAYS = 90;
const BUMP_POINTS = 6;
const BUMP_TOP_N = 8;

// Real per-entry filters, never a fabricated series. "Patents" splits out
// from "publications" via the existing Entry.source field within the
// innovation stage (both are already real, just merged in most other
// panels). "Investment" counts NSF grants and hand-verified private funding
// rounds together, but only as activity counts — never their dollar
// totals, same restriction fundingByCountry/periodFunding apply elsewhere,
// since blending public and private capital into one number would
// misrepresent both.
function matchesMeasure(measure: BumpMeasure, e: Entry): boolean {
  switch (measure) {
    case "publications": return e.stage === "innovation" && e.source !== "patent";
    case "patents": return e.stage === "innovation" && e.source === "patent";
    case "scaling": return e.stage === "scaling";
    case "adoption": return e.stage === "adoption";
    case "investment": return e.stage === "investment" && (e.source === "grant" || e.source === "funding-round");
  }
}

// Reconstructs country rank at BUMP_POINTS evenly-spaced moments across the
// trailing BUMP_WINDOW_DAYS, using entriesAsOf — no new stored trend field,
// this is the same "filter to date <= cutoff" trick as findings.ts/
// changeLog.ts, generalized to any measure instead of just innovation.
export function buildBumpData(entries: Entry[], measure: BumpMeasure, now = new Date()): BumpData {
  const filtered = entries.filter((e) => matchesMeasure(measure, e));
  const dates: string[] = [];
  for (let i = BUMP_POINTS - 1; i >= 0; i--) {
    const daysBack = Math.round((i / (BUMP_POINTS - 1)) * BUMP_WINDOW_DAYS);
    dates.push(daysAgo(daysBack, now).toISOString().slice(0, 10));
  }
  const snapshots = dates.map((d) => countByCountry(entriesAsOf(filtered, d)));
  const current = snapshots[snapshots.length - 1];
  const topCountries = Object.entries(current)
    .sort((a, b) => b[1] - a[1])
    .slice(0, BUMP_TOP_N)
    .map(([country]) => country);
  const series: BumpSeries[] = topCountries.map((country) => ({
    country,
    ranks: snapshots.map((counts) => rankOf(counts, country)),
  }));
  return { dates, series };
}
