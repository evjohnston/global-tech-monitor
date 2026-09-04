import type { Entry, Stage } from "./types.ts";
import type { Dashboard } from "./urlState.ts";
import type { DrawerTarget } from "./drawerTarget.ts";
import { countByCountry, countryShares, orgLeaderboard, concentrationShare, rankOf, innovationForCounting } from "./aggregate.ts";
import { entriesAsOf, daysAgo } from "./history.ts";
import { countryName } from "./countries.ts";
import { THRESHOLDS } from "./thresholds.ts";

export interface Finding {
  id: string;
  text: string;
  period?: string;
  target: DrawerTarget | null;
  scrollToId?: string;
}

const DASHBOARD_STAGE: Partial<Record<Dashboard, Stage>> = {
  research: "innovation", scaling: "scaling", adoption: "adoption", money: "investment",
};
const STAGE_DASHBOARD_ID: Record<Stage, string> = {
  innovation: "research-leadership", scaling: "scaling-leadership", adoption: "adoption-leadership", investment: "grants",
};
const STAGE_LABEL: Record<Stage, string> = { innovation: "research", scaling: "scaling", adoption: "adoption", investment: "money" };

// Real leader-vs-runner-up rank crossovers within one stage over the
// comparison window — the closest general-purpose version of the same
// "who passed whom" narrative changeLog.ts already uses for the Overview,
// reused here per-dashboard so a rank crossover surfaces on the dashboard
// it actually happened on, not just in the Overview's global feed.
function rankCrossoverFindings(entries: Entry[], stage: Stage, now: Date): Finding[] {
  const past = entriesAsOf(entries, daysAgo(THRESHOLDS.windowDays, now));
  if (past.length === 0) return [];
  const pastCounts = countByCountry(past, stage);
  const currentCounts = countByCountry(entries, stage);
  const findings: Finding[] = [];
  for (const winner of Object.keys(currentCounts)) {
    const pastRank = rankOf(pastCounts, winner);
    const currentRank = rankOf(currentCounts, winner);
    if (pastRank == null || currentRank == null || currentRank >= pastRank) continue;
    const moved = pastRank - currentRank;
    if (moved < THRESHOLDS.rankChangePlaces && currentRank > THRESHOLDS.rankTopN) continue;
    const loser = Object.keys(pastCounts).find((c) => c !== winner && rankOf(pastCounts, c) === currentRank);
    if (!loser) continue;
    findings.push({
      id: `rank-${stage}-${winner}`,
      text: `${countryName(winner)} passed ${countryName(loser)} in tracked ${STAGE_LABEL[stage]} output, moving from #${pastRank} to #${currentRank}.`,
      period: `${THRESHOLDS.windowDays}-day change`,
      target: { kind: "country", code: winner },
      scrollToId: STAGE_DASHBOARD_ID[stage],
    });
  }
  return findings.sort((a, b) => a.text.length - b.text.length).slice(0, 2);
}

// Real top-1-organization concentration crossing a real band (25/50/75%)
// since the comparison window — a genuine structural shift (the field
// consolidating around fewer real actors), not a rounding wobble.
function concentrationFindings(entries: Entry[], stage: Stage, now: Date): Finding[] {
  const past = entriesAsOf(entries, daysAgo(THRESHOLDS.windowDays, now));
  const currentTotal = entries.filter((e) => e.stage === stage).length;
  const pastTotal = past.filter((e) => e.stage === stage).length;
  if (currentTotal === 0 || pastTotal === 0) return [];
  const currentTop1 = concentrationShare(orgLeaderboard(entries, stage, 10), currentTotal).top1Pct;
  const pastTop1 = concentrationShare(orgLeaderboard(past, stage, 10), pastTotal).top1Pct;
  const crossed = THRESHOLDS.concentrationBands.find((band) => (pastTop1 < band && currentTop1 >= band) || (pastTop1 >= band && currentTop1 < band));
  if (crossed == null) return [];
  const rising = currentTop1 > pastTop1;
  return [{
    id: `concentration-${stage}`,
    text: `The top tracked ${STAGE_LABEL[stage]} organization's share ${rising ? "crossed above" : "fell below"} ${crossed}% of all tracked ${STAGE_LABEL[stage]} activity.`,
    period: `${THRESHOLDS.windowDays}-day change`,
    target: null,
    scrollToId: STAGE_DASHBOARD_ID[stage],
  }];
}

// Verified-share change over the window — only meaningful for
// scaling/adoption, the two stages with a real verified-vs-reported
// distinction in this app's data model.
function verificationChangeFindings(entries: Entry[], stage: Stage, now: Date): Finding[] {
  if (stage !== "scaling" && stage !== "adoption") return [];
  const past = entriesAsOf(entries, daysAgo(THRESHOLDS.windowDays, now));
  const currentStageEntries = entries.filter((e) => e.stage === stage);
  const pastStageEntries = past.filter((e) => e.stage === stage);
  if (currentStageEntries.length === 0 || pastStageEntries.length === 0) return [];
  const verifiedShare = (list: Entry[]) => (list.filter((e) => e.provenance === "seeded").length / list.length) * 100;
  const currentShare = verifiedShare(currentStageEntries);
  const pastShare = verifiedShare(pastStageEntries);
  const delta = currentShare - pastShare;
  if (Math.abs(delta) < THRESHOLDS.verificationChangePt) return [];
  return [{
    id: `verification-${stage}`,
    text: `The share of independently verified ${STAGE_LABEL[stage]} records ${delta > 0 ? "rose" : "fell"} ${Math.abs(delta).toFixed(0)} percentage points, to ${currentShare.toFixed(0)}%.`,
    period: `${THRESHOLDS.windowDays}-day change`,
    target: null,
    scrollToId: STAGE_DASHBOARD_ID[stage],
  }];
}

// Unfiltered findings for the active dashboard — rank crossovers,
// concentration shifts, and verification-rate changes, all real diffs
// against a real historical reconstruction (entriesAsOf), never invented.
function computeUnfilteredFindings(entries: Entry[], dashboard: Dashboard, now = new Date()): Finding[] {
  const stage = DASHBOARD_STAGE[dashboard];
  if (!stage) return [];
  const findings = [
    ...rankCrossoverFindings(entries, stage, now),
    ...concentrationFindings(entries, stage, now),
    ...verificationChangeFindings(entries, stage, now),
  ];
  return findings.slice(0, 4);
}

// Country-filtered findings (section 5.6) — the exact shapes the brief
// asks for: a cross-stage share disconnect, top-institution concentration
// within that country, verified-vs-reported counts, and that country's
// single strongest tracked position across all 4 stages. Every value here
// is computed fresh from the current filtered scope, never hardcoded.
function computeCountryFindings(entries: Entry[], country: string): Finding[] {
  const findings: Finding[] = [];
  const stages: Stage[] = ["innovation", "scaling", "adoption", "investment"];
  const sharesByStage = Object.fromEntries(stages.map((s) => [s, countryShares(countByCountry(entries, s))[country] ?? 0])) as Record<Stage, number>;
  const rankByStage = Object.fromEntries(stages.map((s) => [s, rankOf(countByCountry(entries, s), country)])) as Record<Stage, number | null>;

  // 1. Cross-stage disconnect: the two stages with the largest real gap.
  let maxGap = { a: stages[0], b: stages[1], gap: -1 };
  for (let i = 0; i < stages.length; i++) {
    for (let j = 0; j < stages.length; j++) {
      if (i === j) continue;
      const gap = sharesByStage[stages[i]] - sharesByStage[stages[j]];
      if (gap > maxGap.gap) maxGap = { a: stages[i], b: stages[j], gap };
    }
  }
  if (maxGap.gap >= THRESHOLDS.shareChangePt && sharesByStage[maxGap.a] > 0) {
    findings.push({
      id: `disconnect-${country}`,
      text: `${countryName(country)} accounts for ${sharesByStage[maxGap.a].toFixed(0)}% of tracked ${STAGE_LABEL[maxGap.a]} but ${sharesByStage[maxGap.b].toFixed(0)}% of tracked ${STAGE_LABEL[maxGap.b]}.`,
      target: { kind: "country", code: country },
    });
  }

  // 2. Top-institution concentration within this country (innovation stage
  // — the one with the richest real institution data).
  const countryInnovation = innovationForCounting(entries).filter((e) => e.country === country);
  if (countryInnovation.length >= 5) {
    const rows = orgLeaderboard(countryInnovation, "innovation", 10);
    const top3 = rows.slice(0, 3);
    if (top3.length > 0) {
      const top3Count = top3.reduce((s, r) => s + r.count, 0);
      const top3Pct = (top3Count / countryInnovation.length) * 100;
      findings.push({
        id: `institutions-${country}`,
        text: `${top3.length} institution${top3.length === 1 ? "" : "s"} account for ${top3Pct.toFixed(0)}% of ${countryName(country)}'s tracked research.`,
        target: { kind: "country", code: country },
      });
    }
  }

  // 3. Verified vs. reported counts, scaling and adoption.
  for (const stage of ["scaling", "adoption"] as const) {
    const list = entries.filter((e) => e.stage === stage && e.country === country);
    const verified = list.filter((e) => e.provenance === "seeded").length;
    const reported = list.filter((e) => e.provenance === "auto").length;
    if (verified + reported === 0) continue;
    if (verified > 0 || reported > 0) {
      findings.push({
        id: `verification-${stage}-${country}`,
        text: `${countryName(country)} has ${verified} verified ${STAGE_LABEL[stage]} record${verified === 1 ? "" : "s"}, compared with ${reported} reported record${reported === 1 ? "" : "s"}.`,
        target: { kind: "country", code: country },
        scrollToId: STAGE_DASHBOARD_ID[stage],
      });
      break; // one verification finding is enough context, not one per stage
    }
  }

  // 4. Strongest tracked position across all 4 stages.
  const rankedStages = stages
    .map((s) => ({ stage: s, rank: rankByStage[s] }))
    .filter((r): r is { stage: Stage; rank: number } => r.rank != null)
    .sort((a, b) => a.rank - b.rank);
  if (rankedStages.length > 1) {
    const best = rankedStages[0];
    findings.push({
      id: `strongest-${country}`,
      text: `${countryName(country)}'s strongest tracked position is ${STAGE_LABEL[best.stage]}, where it ranks #${best.rank}.`,
      target: { kind: "country", code: country },
      scrollToId: STAGE_DASHBOARD_ID[best.stage],
    });
  }

  return findings.slice(0, 4);
}

// The one entry point every dashboard calls — country-filtered findings
// when a country is active (section 5.6), the dashboard's own unfiltered
// findings otherwise. Overview has no single stage, so it pools the top
// findings across all 4 real stages instead.
export function computeDashboardFindings(entries: Entry[], dashboard: Dashboard, country: string | "all", now = new Date()): Finding[] {
  if (country !== "all") return computeCountryFindings(entries, country);
  if (dashboard === "overview") {
    const stages: Dashboard[] = ["research", "scaling", "adoption", "money"];
    return stages.flatMap((d) => computeUnfilteredFindings(entries, d, now)).slice(0, 4);
  }
  return computeUnfilteredFindings(entries, dashboard, now);
}
