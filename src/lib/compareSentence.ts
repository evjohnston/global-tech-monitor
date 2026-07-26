import type { Entry } from "./types.ts";
import { countByCountry, countryShares } from "./aggregate.ts";
import { entriesAsOf, daysAgo } from "./history.ts";
import { countryName } from "./countries.ts";

const GROWTH_WINDOW_DAYS = 42;

// Fixed rule templates over the same real aggregate primitives everything
// else in this app uses — "traceable to the data" per the request, never a
// free-text summary. Returns fewer than 3 sentences (or none) rather than
// padding when a comparison isn't real yet (e.g. fewer than 2 countries
// selected, or not enough history for a growth comparison).
export function compareSentences(entries: Entry[], countries: string[], now = new Date()): string[] {
  if (countries.length < 2) return [];
  const innovation = countByCountry(entries, "innovation");
  const adoption = countByCountry(entries, "adoption");
  const sentences: string[] = [];

  const byResearch = [...countries].sort((a, b) => (innovation[b] ?? 0) - (innovation[a] ?? 0));
  if ((innovation[byResearch[0]] ?? 0) > 0) {
    sentences.push(
      `${countryName(byResearch[0])} has the largest tracked research base among the selected countries (${innovation[byResearch[0]]} innovation-stage entries).`
    );
  }

  const past = entriesAsOf(entries, daysAgo(GROWTH_WINDOW_DAYS, now));
  if (past.length > 0) {
    const pastShares = countryShares(countByCountry(past, "innovation"));
    const currentShares = countryShares(innovation);
    const byGrowth = [...countries].sort(
      (a, b) => (currentShares[b] ?? 0) - (pastShares[b] ?? 0) - ((currentShares[a] ?? 0) - (pastShares[a] ?? 0))
    );
    const top = byGrowth[0];
    const gain = (currentShares[top] ?? 0) - (pastShares[top] ?? 0);
    if (gain > 0.1) {
      sentences.push(
        `${countryName(top)} gained the most innovation share among the selected countries over the trailing ${GROWTH_WINDOW_DAYS} days (+${gain.toFixed(1)}pt).`
      );
    }
  }

  const ratios = countries
    .map((c) => ({ country: c, innov: innovation[c] ?? 0, adopt: adoption[c] ?? 0 }))
    .filter((r) => r.innov > 0 && r.adopt > 0)
    .map((r) => ({ country: r.country, ratio: r.adopt / r.innov }));
  if (ratios.length >= 2) {
    ratios.sort((a, b) => b.ratio - a.ratio);
    sentences.push(
      `${countryName(ratios[0].country)} has more adoption activity relative to its research output than the other selected countries.`
    );
  }

  return sentences.slice(0, 3);
}
