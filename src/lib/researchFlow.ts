import type { Entry } from "./types.ts";
import { countryName } from "./countries.ts";
import { canonicalizeOrg } from "./entityResolution.ts";

export interface ResearchFlowNode {
  id: string;
  label: string;
  kind: "country" | "institution" | "output";
  count: number;
}

export interface ResearchFlowLink {
  source: string;
  target: string;
  value: number;
}

export interface ResearchFlowData {
  nodes: ResearchFlowNode[];
  links: ResearchFlowLink[];
  omittedCountries: number;
  omittedInstitutions: number;
}

export const RESEARCH_FLOW_TOP_COUNTRIES = 8;
export const RESEARCH_FLOW_TOP_INSTITUTIONS = 18;

export const OUTPUT_PUBLICATIONS = "output:publications";
export const OUTPUT_PATENTS = "output:patents";

// Real Country -> Institution -> Output-type flow, built entirely from
// innovation-stage Entry fields already on hand (country, org/orgId,
// source) — no new data source. Institutions are grouped by the same
// canonicalizeOrg() id orgLeaderboard() already uses, so this never
// double-counts a name variant as a separate institution. A country only
// links to an institution actually headquartered there (an institution's
// single resolved `country` — same "institution location, not a person's
// nationality" convention as the rest of this app), and an institution
// only links to "Publications" or "Patents" by each real record's
// Entry.source, matching the split TrackResearch's own KPI row already uses.
export function buildResearchFlow(entries: Entry[], opts: { topCountries?: number; topInstitutions?: number } = {}): ResearchFlowData {
  const { topCountries = RESEARCH_FLOW_TOP_COUNTRIES, topInstitutions = RESEARCH_FLOW_TOP_INSTITUTIONS } = opts;
  const innovation = entries.filter((e) => e.stage === "innovation" && e.country && e.org);

  const countryTotals = new Map<string, number>();
  const institutionTotals = new Map<string, number>();
  const institutionLabel = new Map<string, string>();
  const institutionCountry = new Map<string, string>();
  const countryInstitutionCounts = new Map<string, Map<string, number>>();
  const institutionOutput = new Map<string, { pub: number; patent: number }>();

  for (const e of innovation) {
    const country = e.country!;
    const inst = canonicalizeOrg(e.org).id;
    countryTotals.set(country, (countryTotals.get(country) ?? 0) + 1);
    institutionTotals.set(inst, (institutionTotals.get(inst) ?? 0) + 1);
    institutionLabel.set(inst, e.org);
    institutionCountry.set(inst, country);
    let byInst = countryInstitutionCounts.get(country);
    if (!byInst) { byInst = new Map(); countryInstitutionCounts.set(country, byInst); }
    byInst.set(inst, (byInst.get(inst) ?? 0) + 1);
    const out = institutionOutput.get(inst) ?? { pub: 0, patent: 0 };
    if (e.source === "patent") out.patent += 1; else out.pub += 1;
    institutionOutput.set(inst, out);
  }

  const rankedCountries = [...countryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const topCountryIds = rankedCountries.slice(0, topCountries).map(([c]) => c);
  const topCountrySet = new Set(topCountryIds);

  // Top institutions BY OVERALL VOLUME within the shown countries, not top-N
  // per country — a per-country cut would force in a country's tiny 1-paper
  // institution just to fill a slot, diluting the diagram with noise a
  // volume-ranked cut avoids.
  const candidateInstitutions = [...institutionTotals.entries()]
    .filter(([id]) => topCountrySet.has(institutionCountry.get(id)!))
    .sort((a, b) => b[1] - a[1]);
  const topInstitutionIds = candidateInstitutions.slice(0, topInstitutions).map(([id]) => id);
  const topInstitutionSet = new Set(topInstitutionIds);

  const links: ResearchFlowLink[] = [];
  for (const country of topCountryIds) {
    const byInst = countryInstitutionCounts.get(country);
    if (!byInst) continue;
    for (const [inst, count] of byInst) {
      if (!topInstitutionSet.has(inst)) continue;
      links.push({ source: country, target: inst, value: count });
    }
  }
  let pubTotal = 0, patentTotal = 0;
  for (const inst of topInstitutionIds) {
    const out = institutionOutput.get(inst)!;
    if (out.pub > 0) { links.push({ source: inst, target: OUTPUT_PUBLICATIONS, value: out.pub }); pubTotal += out.pub; }
    if (out.patent > 0) { links.push({ source: inst, target: OUTPUT_PATENTS, value: out.patent }); patentTotal += out.patent; }
  }

  const usedCountries = new Set(links.map((l) => l.source).filter((id) => topCountrySet.has(id)));
  const nodes: ResearchFlowNode[] = [
    ...topCountryIds.filter((c) => usedCountries.has(c)).map((c) => ({ id: c, label: countryName(c), kind: "country" as const, count: countryTotals.get(c) ?? 0 })),
    ...topInstitutionIds.map((id) => ({ id, label: institutionLabel.get(id) ?? id, kind: "institution" as const, count: institutionTotals.get(id) ?? 0 })),
    ...(pubTotal > 0 ? [{ id: OUTPUT_PUBLICATIONS, label: "Publications", kind: "output" as const, count: pubTotal }] : []),
    ...(patentTotal > 0 ? [{ id: OUTPUT_PATENTS, label: "Patents", kind: "output" as const, count: patentTotal }] : []),
  ];

  return {
    nodes,
    links,
    omittedCountries: Math.max(0, rankedCountries.length - topCountryIds.length),
    omittedInstitutions: Math.max(0, candidateInstitutions.length - topInstitutionIds.length),
  };
}

// Real underlying entries for one link in the flow — feeds the metadata
// drawer / tooltip drill-down, same role dealsForLink() plays for the money
// Sankey.
export function entriesForResearchFlowLink(entries: Entry[], sourceId: string, targetId: string): Entry[] {
  const isOutput = targetId === OUTPUT_PUBLICATIONS || targetId === OUTPUT_PATENTS;
  return entries.filter((e) => {
    if (e.stage !== "innovation" || !e.country || !e.org) return false;
    const inst = canonicalizeOrg(e.org).id;
    if (isOutput) {
      if (inst !== sourceId) return false;
      return targetId === OUTPUT_PATENTS ? e.source === "patent" : e.source !== "patent";
    }
    return e.country === sourceId && inst === targetId;
  });
}
