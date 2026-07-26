import type { Entry, Stage } from "./types.ts";
import { STAGES } from "./types.ts";
import { countByCountry, orgLeaderboard, rankOf } from "./aggregate.ts";
import { entriesAsOf, daysAgo } from "./history.ts";

export interface CountryProfile {
  code: string;
  ranks: { stage: Stage; label: string; rank: number | null; count: number }[];
  leadingInstitution: string | null;
  strongestStage: Stage | null;
  weakestStage: Stage | null;
  largestRecentChangeLabel: string | null;
}

const CHANGE_WINDOW_DAYS = 42;

// Shared by the Overview's inline selected-country panel and the metadata
// drawer's country view, so "Germany · Research #4 · Scaling #8..." always
// means the exact same computation in both places.
export function computeCountryProfile(entries: Entry[], code: string, now = new Date()): CountryProfile {
  const ranks = STAGES.map((s) => {
    const counts = countByCountry(entries, s.id);
    return { stage: s.id, label: s.label, rank: rankOf(counts, code), count: counts[code] ?? 0 };
  });
  const ranked = ranks.filter((r) => r.rank != null);
  const strongestStage = ranked.length > 0 ? [...ranked].sort((a, b) => a.rank! - b.rank!)[0].stage : null;
  const weakestStage = ranked.length > 1 ? [...ranked].sort((a, b) => b.rank! - a.rank!)[0].stage : null;

  const countryEntries = entries.filter((e) => e.country === code);
  const topOrg = orgLeaderboard(countryEntries, undefined, 1)[0];

  const past = entriesAsOf(entries, daysAgo(CHANGE_WINDOW_DAYS, now));
  let largestRecentChangeLabel: string | null = null;
  if (past.length > 0) {
    let best: { stage: Stage; label: string; delta: number } | null = null;
    for (const s of STAGES) {
      const past1 = countByCountry(past, s.id)[code] ?? 0;
      const now1 = countByCountry(entries, s.id)[code] ?? 0;
      const delta = now1 - past1;
      if (delta > 0 && (!best || delta > best.delta)) best = { stage: s.id, label: s.label, delta };
    }
    if (best) largestRecentChangeLabel = `+${best.delta} ${best.label.toLowerCase()} entries over the trailing ${CHANGE_WINDOW_DAYS} days`;
  }

  return {
    code,
    ranks,
    leadingInstitution: topOrg?.org ?? null,
    strongestStage,
    weakestStage,
    largestRecentChangeLabel,
  };
}
