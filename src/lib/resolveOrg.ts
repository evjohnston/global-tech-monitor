import type { Entry } from "./types.ts";
import { entriesForOrg } from "./aggregate.ts";
import type { OrgFinancialIndex } from "./orgFinancials.ts";

export type OrgResolution =
  | { status: "entries"; name: string; entries: Entry[] }
  | { status: "financial-only"; name: string; hasTicker: boolean; hasVc: boolean }
  | { status: "unresolved"; fuzzyMatches: Entry[] };

// The single real resolution path a visible institution/company link goes
// through — used by both MetadataDrawer's OrgBody and this file's own
// tests, so "does this link work" is verifiable without rendering React.
// Three real outcomes, never a bare "not found": a real Entry-backed
// profile, a real financial-only profile (a company can be legitimately
// tracked with zero papers/patents/milestones — not broken), or an honest
// unresolved state that still searches entries for the raw label text
// before giving up.
export function resolveOrgProfile(entries: Entry[], orgFinancialIndex: OrgFinancialIndex, orgId: string, label?: string): OrgResolution {
  const orgEntries = entriesForOrg(entries, orgId);
  if (orgEntries.length > 0) {
    return { status: "entries", name: orgEntries[0].org, entries: orgEntries };
  }
  const ticker = orgFinancialIndex.orgIdToTicker.get(orgId);
  const vc = orgFinancialIndex.orgIdToVc.get(orgId);
  if (ticker || vc) {
    return { status: "financial-only", name: ticker?.name ?? vc?.name ?? label ?? orgId, hasTicker: !!ticker, hasVc: !!vc };
  }
  const needle = (label ?? orgId).toLowerCase();
  const fuzzyMatches = needle.length >= 3 ? entries.filter((e) => e.org && e.org.toLowerCase().includes(needle)).slice(0, 8) : [];
  return { status: "unresolved", fuzzyMatches };
}
