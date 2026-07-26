import type { Entry } from "./types.ts";
import { countByCountry, countryShares } from "./aggregate.ts";
import { countryName } from "./countries.ts";
import { buildBumpData, type BumpMeasure } from "./bumpChart.ts";
import { collaborationEdges } from "./collaboration.ts";

const MEASURE_LABEL: Record<BumpMeasure, string> = {
  publications: "Publication",
  patents: "Patent",
  scaling: "Scaling",
  adoption: "Adoption",
  investment: "Investment",
};

// Deterministic, data-derived chart titles — a fixed template filled with
// real numbers, never free text. Falls back to a plain descriptive title
// when there isn't a real enough signal to state a claim (too few
// countries, no movement) — same "omit rather than overstate" discipline
// as findings.ts.
export function innovationByCountryClaim(entries: Entry[]): string {
  const counts = countByCountry(entries, "innovation");
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return "Output by country · innovation stage";
  if (ranked.length === 1) return `${countryName(ranked[0][0])} is the only country with tracked innovation output so far`;
  const shares = countryShares(counts);
  const leaderShare = shares[ranked[0][0]] ?? 0;
  return leaderShare > 50
    ? `${countryName(ranked[0][0])} holds a majority share of tracked innovation output`
    : `${countryName(ranked[0][0])} leads tracked innovation output, but no country holds a majority share`;
}

export function fundingByCountryClaim(entries: Entry[]): string {
  const grants = entries.filter((e) => e.stage === "investment" && e.source === "grant" && e.country);
  const counts = countByCountry(grants, "investment");
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked.length < 2) return "Funding by country · investment";
  return `${countryName(ranked[0][0])} receives the most disclosed public research funding tracked here`;
}

export function collaborationClaim(entries: Entry[]): string {
  const edges = collaborationEdges(entries);
  if (edges.length === 0) return "Which countries collaborate across borders?";
  const top = edges[0];
  return `${countryName(top.a)} and ${countryName(top.b)} collaborate more than any other country pair`;
}

export function bumpChartClaim(entries: Entry[], measure: BumpMeasure): string {
  const data = buildBumpData(entries, measure);
  if (data.series.length < 2) return `${MEASURE_LABEL[measure]} rank over time`;
  let biggestMover: { country: string; delta: number } | null = null;
  for (const s of data.series) {
    const first = s.ranks.find((r) => r != null);
    const last = [...s.ranks].reverse().find((r) => r != null);
    if (first == null || last == null) continue;
    const delta = first - last; // positive = moved up (rank number decreased)
    if (!biggestMover || Math.abs(delta) > Math.abs(biggestMover.delta)) biggestMover = { country: s.country, delta };
  }
  if (!biggestMover || biggestMover.delta === 0) return `${MEASURE_LABEL[measure]} rank has been stable among the tracked leaders`;
  return biggestMover.delta > 0
    ? `${countryName(biggestMover.country)} has climbed the ${MEASURE_LABEL[measure].toLowerCase()} rankings over the tracked window`
    : `${countryName(biggestMover.country)} has slipped in the ${MEASURE_LABEL[measure].toLowerCase()} rankings over the tracked window`;
}
