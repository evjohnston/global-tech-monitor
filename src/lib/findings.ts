import type { Entry, Stage } from "./types.ts";
import { STAGES } from "./types.ts";
import { countByCountry, concentrationShare, orgLeaderboard, countryShares } from "./aggregate.ts";
import { entriesAsOf, daysAgo } from "./history.ts";
import { countryName } from "./countries.ts";

export interface FindingCard {
  key: "fastestRiser" | "largestLead" | "biggestDisconnect" | "mostConcentrated";
  label: string;
  value: string;
  deltaLabel?: string;
  context: string;
}

// How far back "fastest riser" looks for a real gain — same 42-day bar
// App.tsx's velocityDeltaReady already uses before trusting a percent
// change, so this card and the KPI row apply the same honesty standard.
const RISER_WINDOW_DAYS = 42;

// Country with the largest real point-share gain in tracked innovation
// output over the trailing window. Returns null (card omitted, never
// fabricated) when there isn't enough real history to compare against, or
// when nothing actually gained ground.
export function fastestRiser(entries: Entry[], now = new Date()): FindingCard | null {
  const past = entriesAsOf(entries, daysAgo(RISER_WINDOW_DAYS, now));
  if (past.length === 0) return null;
  const pastShares = countryShares(countByCountry(past, "innovation"));
  const currentShares = countryShares(countByCountry(entries, "innovation"));
  let best: { country: string; gain: number } | null = null;
  for (const country of Object.keys(currentShares)) {
    const gain = currentShares[country] - (pastShares[country] ?? 0);
    if (!best || gain > best.gain) best = { country, gain };
  }
  if (!best || best.gain <= 0) return null;
  return {
    key: "fastestRiser",
    label: "Fastest riser",
    value: countryName(best.country),
    deltaLabel: `+${best.gain.toFixed(1)}pt share`,
    context: `${countryName(best.country)}'s share of tracked innovation output rose ${best.gain.toFixed(1)} points over the trailing ${RISER_WINDOW_DAYS} days.`,
  };
}

// The stage with the widest #1-vs-#2 country gap, as a share of that
// stage's total — real per-stage country counts (countByCountry already
// supports a stage filter), no new counting logic.
export function largestLead(entries: Entry[]): FindingCard | null {
  let best: { stage: Stage; leader: string; gap: number } | null = null;
  for (const s of STAGES) {
    const counts = countByCountry(entries, s.id);
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (ranked.length < 2) continue;
    const total = ranked.reduce((sum, [, n]) => sum + n, 0) || 1;
    const gap = ((ranked[0][1] - ranked[1][1]) / total) * 100;
    if (!best || gap > best.gap) best = { stage: s.id, leader: ranked[0][0], gap };
  }
  if (!best) return null;
  const stageLabel = STAGES.find((s) => s.id === best!.stage)!.label;
  return {
    key: "largestLead",
    label: "Largest lead",
    value: `${countryName(best.leader)} · ${stageLabel}`,
    deltaLabel: `${best.gap.toFixed(0)}pt gap to #2`,
    context: `${countryName(best.leader)} holds the widest gap over its nearest rival in ${stageLabel.toLowerCase()}.`,
  };
}

// Country with the largest gap between its innovation share and its
// adoption share — a real, available proxy for "strong research, weak
// commercial conversion" (or the reverse), since adoption-stage entries are
// literally deployment/procurement records, not a fabricated axis.
export function biggestDisconnect(entries: Entry[]): FindingCard | null {
  const innovation = countryShares(countByCountry(entries, "innovation"));
  const adoption = countryShares(countByCountry(entries, "adoption"));
  const countries = new Set([...Object.keys(innovation), ...Object.keys(adoption)]);
  if (countries.size < 2) return null;
  let best: { country: string; gap: number } | null = null;
  for (const country of countries) {
    const gap = (innovation[country] ?? 0) - (adoption[country] ?? 0);
    if (!best || Math.abs(gap) > Math.abs(best.gap)) best = { country, gap };
  }
  if (!best || Math.abs(best.gap) < 1) return null;
  const context = best.gap > 0
    ? `${countryName(best.country)} has a much larger share of research output than of adoption activity.`
    : `${countryName(best.country)} has a much larger share of adoption activity than of research output.`;
  return {
    key: "biggestDisconnect",
    label: "Biggest disconnect",
    value: countryName(best.country),
    deltaLabel: `${Math.abs(best.gap).toFixed(1)}pt gap`,
    context,
  };
}

// Stage where the single leading real org (entity-resolved, see
// entityResolution.ts) accounts for the largest share of tracked activity.
export function mostConcentrated(entries: Entry[]): FindingCard | null {
  let best: { stage: Stage; top1Pct: number; org: string } | null = null;
  for (const s of STAGES) {
    const total = entries.filter((e) => e.stage === s.id).length;
    if (total === 0) continue;
    const rows = orgLeaderboard(entries, s.id, 10);
    if (rows.length === 0) continue;
    const { top1Pct } = concentrationShare(rows, total);
    if (!best || top1Pct > best.top1Pct) best = { stage: s.id, top1Pct, org: rows[0].org };
  }
  if (!best) return null;
  const stageLabel = STAGES.find((s) => s.id === best!.stage)!.label;
  return {
    key: "mostConcentrated",
    label: "Most concentrated area",
    value: stageLabel,
    deltaLabel: `${best.top1Pct.toFixed(0)}% from one org`,
    context: `${best.org} alone accounts for ${best.top1Pct.toFixed(0)}% of tracked ${stageLabel.toLowerCase()} activity.`,
  };
}

export function computeFindings(entries: Entry[], now = new Date()): FindingCard[] {
  return [fastestRiser(entries, now), largestLead(entries), biggestDisconnect(entries), mostConcentrated(entries)].filter(
    (c): c is FindingCard => c != null
  );
}

// A short, deterministic headline built from whichever card is most
// notable — the "biggest disconnect" reads most like an argument, so it
// leads when present; otherwise falls back to a real, generic framing
// rather than a fabricated specific claim.
export function headline(cards: FindingCard[]): string | null {
  if (cards.length === 0) return null;
  const disconnect = cards.find((c) => c.key === "biggestDisconnect");
  if (disconnect) {
    // Splice the disconnect sentence in as its own clause rather than
    // lowercasing its first letter to fit mid-sentence — country names are
    // proper nouns ("China," "United States"), and lowercasing one to make
    // the grammar flow reads as a typo, not a stylistic join.
    return `Leadership is divided across research, scaling, adoption, and investment: ${disconnect.context}`;
  }
  return "No single country leads on every measure tracked here.";
}
