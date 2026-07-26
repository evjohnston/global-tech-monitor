import type { Entry } from "./types.ts";
import { countByCountry, orgLeaderboard, concentrationShare, rankOf } from "./aggregate.ts";
import { entriesAsOf, daysAgo } from "./history.ts";
import { countryName } from "./countries.ts";

export interface ChangeLogItem {
  key: string;
  text: string;
}

const CHANGE_LOG_WINDOW_DAYS = 7;
const MAX_CROSSOVERS = 3;

// Every item here is a real diff against entriesAsOf(now - 7d) — the same
// accumulating-corpus reconstruction findings.ts uses — never a fabricated
// "what's new" summary. Returns [] rather than padded placeholder items
// when there isn't 7 real days of history to diff against yet.
export function computeChangeLog(entries: Entry[], now = new Date()): ChangeLogItem[] {
  const past = entriesAsOf(entries, daysAgo(CHANGE_LOG_WINDOW_DAYS, now));
  if (past.length === 0) return [];
  const items: ChangeLogItem[] = [];

  // Rank crossovers in innovation share: for each country whose rank
  // improved, the "loser" is whoever occupied that exact rank a week ago —
  // the most natural real "X passed Y" narrative, not just any pair whose
  // counts happened to cross.
  const pastCounts = countByCountry(past, "innovation");
  const currentCounts = countByCountry(entries, "innovation");
  const crossovers: { winner: string; loser: string; from: number; to: number }[] = [];
  for (const winner of Object.keys(currentCounts)) {
    const pastRank = rankOf(pastCounts, winner);
    const currentRank = rankOf(currentCounts, winner);
    if (pastRank == null || currentRank == null || currentRank >= pastRank) continue;
    const loser = Object.keys(pastCounts).find((c) => c !== winner && rankOf(pastCounts, c) === currentRank);
    if (loser) crossovers.push({ winner, loser, from: pastRank, to: currentRank });
  }
  crossovers
    .sort((a, b) => b.from - b.to - (a.from - a.to))
    .slice(0, MAX_CROSSOVERS)
    .forEach((c) => {
      items.push({
        key: `crossover-${c.winner}-${c.loser}`,
        text: `${countryName(c.winner)} passed ${countryName(c.loser)} in tracked innovation output, moving from #${c.from} to #${c.to}.`,
      });
    });

  // Concentration change, innovation stage
  const pastTotal = past.filter((e) => e.stage === "innovation").length;
  const currentTotal = entries.filter((e) => e.stage === "innovation").length;
  if (pastTotal > 0 && currentTotal > 0) {
    const pastTop1 = concentrationShare(orgLeaderboard(past, "innovation", 10), pastTotal).top1Pct;
    const currentTop1 = concentrationShare(orgLeaderboard(entries, "innovation", 10), currentTotal).top1Pct;
    const delta = currentTop1 - pastTop1;
    if (Math.abs(delta) >= 2) {
      items.push({
        key: "concentration",
        text: `Innovation-stage concentration ${delta > 0 ? "increased" : "declined"} — the top institution's share moved from ${pastTop1.toFixed(0)}% to ${currentTop1.toFixed(0)}%.`,
      });
    }
  }

  // New institution in the innovation top 10 — real accumulating-corpus
  // comparison (an org whose entries only recently pushed it into the top
  // 10), not an invented event.
  const pastTop10 = new Set(orgLeaderboard(past, "innovation", 10).map((r) => r.org));
  const newEntrant = orgLeaderboard(entries, "innovation", 10).find((r) => !pastTop10.has(r.org));
  if (newEntrant) {
    items.push({
      key: "new-institution",
      text: `${newEntrant.org} entered the top 10 innovation-stage institutions in the last ${CHANGE_LOG_WINDOW_DAYS} days.`,
    });
  }

  // New entries this week
  const pastIds = new Set(past.map((p) => p.id));
  const newEntries = entries.filter((e) => !pastIds.has(e.id));
  if (newEntries.length > 0) {
    const countries = new Set(newEntries.map((e) => e.country).filter((c): c is string => !!c));
    items.push({
      key: "new-entries",
      text: `${newEntries.length} new ${newEntries.length === 1 ? "entry" : "entries"} added in the last ${CHANGE_LOG_WINDOW_DAYS} days, across ${countries.size} ${countries.size === 1 ? "country" : "countries"}.`,
    });
  }

  return items;
}
