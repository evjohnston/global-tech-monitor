import type { Entry, Stage } from "./types.ts";
import { countByCountry, countryShares, investmentUsdByCountry } from "./aggregate.ts";

export type StackMetric = "research" | "scaling" | "adoption" | "money";
export const STACK_METRICS: { key: StackMetric; label: string; stage: Stage }[] = [
  { key: "research", label: "Research", stage: "innovation" },
  { key: "scaling", label: "Scaling", stage: "scaling" },
  { key: "adoption", label: "Adoption", stage: "adoption" },
  { key: "money", label: "Money", stage: "investment" },
];

export interface StackComparisonRow {
  country: string;
  shareByMetric: Record<StackMetric, number>;
}

// Real per-stage share (share of tracked activity within THAT stage,
// computed independently per stage — never a cross-stage weighted blend)
// for a small set of countries, feeding the Overview's "leadership across
// the stack" comparison chart. Countries with zero tracked activity in a
// stage get 0%, a real computed value (not a missing-data placeholder —
// share-of-zero-total is a genuine "no share" for a country that IS
// tracked elsewhere, distinct from a stage with no comparable feed at all,
// which the ecosystem matrix already flags separately). Money uses real
// disclosed dollar share (investmentUsdByCountry), not entry count — same
// reasoning as the ecosystem matrix: NSF's much larger number of smaller
// grants would otherwise swamp a country with one real, large, disclosed
// private round.
export function stackComparison(entries: Entry[], countries: string[]): StackComparisonRow[] {
  const sharesByStage = Object.fromEntries(
    STACK_METRICS.map((m) => [m.key, countryShares(m.key === "money" ? investmentUsdByCountry(entries) : countByCountry(entries, m.stage))])
  ) as Record<StackMetric, Record<string, number>>;

  return countries.map((country) => ({
    country,
    shareByMetric: Object.fromEntries(STACK_METRICS.map((m) => [m.key, sharesByStage[m.key][country] ?? 0])) as Record<StackMetric, number>,
  }));
}

export interface ResearchAdoptionGapRow {
  country: string;
  researchSharePct: number;
  adoptionSharePct: number;
  gapPct: number;
}

// "Research share minus adoption share," for whichever countries lead
// either stage — answers "who has more research activity than adoption
// activity" as an explicit, labeled measure, never framed as a conversion
// rate or a causal research-to-adoption pipeline.
export function researchAdoptionGap(entries: Entry[], countries: string[]): ResearchAdoptionGapRow[] {
  const researchShares = countryShares(countByCountry(entries, "innovation"));
  const adoptionShares = countryShares(countByCountry(entries, "adoption"));
  return countries
    .map((country) => {
      const researchSharePct = researchShares[country] ?? 0;
      const adoptionSharePct = adoptionShares[country] ?? 0;
      return { country, researchSharePct, adoptionSharePct, gapPct: researchSharePct - adoptionSharePct };
    })
    .sort((a, b) => b.gapPct - a.gapPct);
}
