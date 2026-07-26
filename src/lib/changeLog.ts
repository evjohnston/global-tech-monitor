import type { Entry } from "./types.ts";
import { countByCountry, orgLeaderboard, concentrationShare, rankOf } from "./aggregate.ts";
import { entriesAsOf, daysAgo } from "./history.ts";
import { countryName } from "./countries.ts";
import { canonicalizeOrg } from "./entityResolution.ts";
import type { DrawerTarget } from "./drawerTarget.ts";

export interface ChangeLogItem {
  key: string;
  text: string;
  drawerTarget?: DrawerTarget;
  activateCountry?: string;
  evidence: { label: string; value: string }[];
  // Real entry ids that are new since the 7-day-old reconstruction — the
  // one honestly answerable part of "did this come from new records or a
  // revision." See the caveat string for what this app's data model can't
  // tell you.
  newEntryIds?: string[];
  caveat?: string;
}

const CHANGE_LOG_WINDOW_DAYS = 7;
const MAX_CROSSOVERS = 3;

// This app's entries[] keeps only each record's CURRENT attribution, not a
// history of past attributions — so "did this rank change come from new
// records or a corrected country field on an old one" can only be answered
// for the "new records" half. A record's country COULD have been revised
// between the two snapshots being compared (fetch-data.ts overwrites an
// entry's fields wholesale on re-fetch, not just append-only), and this
// function has no way to detect that after the fact. State that plainly
// rather than implying more certainty than the data supports.
const ATTRIBUTION_CAVEAT =
  "This app keeps only each record's current attribution, not a history of past corrections — so a rank shift always reflects at least the new records listed here, but can't rule out an older record's country also having been revised in the same window.";

// Every real item here is a diff against entriesAsOf(now - 7d) — the same
// accumulating-corpus reconstruction findings.ts uses — never a fabricated
// "what's new" summary. Returns [] rather than padded placeholder items
// when there isn't 7 real days of history to diff against yet.
export function computeChangeLog(entries: Entry[], now = new Date()): ChangeLogItem[] {
  const past = entriesAsOf(entries, daysAgo(CHANGE_LOG_WINDOW_DAYS, now));
  if (past.length === 0) return [];
  const items: ChangeLogItem[] = [];
  const pastIds = new Set(past.map((p) => p.id));
  const newEntries = entries.filter((e) => !pastIds.has(e.id));
  const newIdsByCountry = new Map<string, string[]>();
  for (const e of newEntries) {
    if (!e.country) continue;
    const list = newIdsByCountry.get(e.country) ?? [];
    list.push(e.id);
    newIdsByCountry.set(e.country, list);
  }

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
      const winnerNewIds = newIdsByCountry.get(c.winner) ?? [];
      items.push({
        key: `crossover-${c.winner}-${c.loser}`,
        text: `${countryName(c.winner)} passed ${countryName(c.loser)} in tracked innovation output, moving from #${c.from} to #${c.to}.`,
        drawerTarget: { kind: "country", code: c.winner },
        activateCountry: c.winner,
        evidence: [
          { label: `${countryName(c.loser)} rank, ${CHANGE_LOG_WINDOW_DAYS}d ago`, value: `#${c.from > c.to ? c.to : c.from}` },
          { label: `${countryName(c.winner)} rank, ${CHANGE_LOG_WINDOW_DAYS}d ago`, value: `#${c.from}` },
          { label: `${countryName(c.winner)} rank, now`, value: `#${c.to}` },
          { label: `${countryName(c.winner)} entries, ${CHANGE_LOG_WINDOW_DAYS}d ago`, value: String(pastCounts[c.winner] ?? 0) },
          { label: `${countryName(c.winner)} entries, now`, value: String(currentCounts[c.winner] ?? 0) },
          { label: "New entries in this window", value: String(winnerNewIds.length) },
        ],
        newEntryIds: winnerNewIds,
        caveat: ATTRIBUTION_CAVEAT,
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
        evidence: [
          { label: `Top-org share, ${CHANGE_LOG_WINDOW_DAYS}d ago`, value: `${pastTop1.toFixed(1)}%` },
          { label: "Top-org share, now", value: `${currentTop1.toFixed(1)}%` },
        ],
      });
    }
  }

  // New institution in the innovation top 10 — real accumulating-corpus
  // comparison (an org whose entries only recently pushed it into the top
  // 10), not an invented event.
  const pastTop10 = new Set(orgLeaderboard(past, "innovation", 10).map((r) => r.org));
  const currentTop10Rows = orgLeaderboard(entries, "innovation", 10);
  const newEntrant = currentTop10Rows.find((r) => !pastTop10.has(r.org));
  if (newEntrant) {
    items.push({
      key: "new-institution",
      text: `${newEntrant.org} entered the top 10 innovation-stage institutions in the last ${CHANGE_LOG_WINDOW_DAYS} days.`,
      drawerTarget: { kind: "org", orgId: canonicalizeOrg(newEntrant.org).id },
      evidence: [{ label: "Tracked entries", value: String(newEntrant.count) }],
    });
  }

  // New entries this week
  if (newEntries.length > 0) {
    const countries = new Set(newEntries.map((e) => e.country).filter((c): c is string => !!c));
    items.push({
      key: "new-entries",
      text: `${newEntries.length} new ${newEntries.length === 1 ? "entry" : "entries"} added in the last ${CHANGE_LOG_WINDOW_DAYS} days, across ${countries.size} ${countries.size === 1 ? "country" : "countries"}.`,
      evidence: [
        { label: "New entries", value: String(newEntries.length) },
        { label: "Countries represented", value: String(countries.size) },
      ],
      newEntryIds: newEntries.map((e) => e.id),
    });
  }

  return items;
}
