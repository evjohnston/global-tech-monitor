// Joins an Entry's org against every real financial source this app tracks
// (public markets, VC/growth funding, corporate R&D spend), keyed by
// canonicalizeOrg (entityResolution.ts) — the same entity resolution
// orgLeaderboard and the VC leaderboard's orgId already use. Lets any entry
// (innovation, scaling, adoption, or investment) surface its org's money
// story in one place, instead of a reader having to separately notice the
// same name recurring across unconnected panels.
//
// Known gap, not a bug: RdSpendPoint.companies only carries a ticker
// symbol, no org name, so the R&D join goes org -> ticker (via companies[])
// -> R&D. A handful of real CapIQ-sourced foreign R&D filers (Samsung,
// SoftBank, Tencent, NTT, Fujitsu, and others — see CLAUDE.md's "Foreign
// R&D spend" section) resolve on Massive's reference endpoint but carry no
// market-cap data, so CompanyMarketPanel already excludes them from
// `companies[]` — which means this join can't find a ticker for them
// either, and their R&D figure won't surface here. Matches the existing
// choice to omit rather than show an empty row; not fixed here.
import type { CompanySnapshot, RdSpendPoint, VcCompanyFunding } from "./types.ts";
import { canonicalizeOrg } from "./entityResolution.ts";

export interface OrgFinancialProfile {
  ticker?: CompanySnapshot;
  vc?: VcCompanyFunding;
  rd?: { fiscalYear: number; amountUsd: number; source: "sec" | "capiq" };
}

export interface OrgFinancialIndex {
  orgIdToTicker: Map<string, CompanySnapshot>;
  orgIdToVc: Map<string, VcCompanyFunding>;
  tickerToLatestRd: Map<string, { fiscalYear: number; amountUsd: number; source: "sec" | "capiq" }>;
}

export function buildOrgFinancialIndex(data: {
  companies?: CompanySnapshot[];
  vcFunding?: VcCompanyFunding[];
  rdSpend?: RdSpendPoint[];
}): OrgFinancialIndex {
  const orgIdToTicker = new Map<string, CompanySnapshot>();
  for (const c of data.companies ?? []) {
    orgIdToTicker.set(canonicalizeOrg(c.name).id, c);
  }

  // Keyed by canonicalizeOrg(v.name), NOT v.orgId — VcCompanyFunding.orgId is
  // CapIQ's own dedup key for merging that source's own transaction rows,
  // and is a raw numeric SPTR_TARGET_ID whenever the export carries one
  // (confirmed by hand: 200/200 of the AI vertical's real vcFunding entries
  // have a numeric orgId, e.g. "11140937" for OpenAI) — it was never meant
  // to be a stable join key against an Entry's `org` string. Re-canonicalizing
  // the resolved display `name` here gives a key space consistent with
  // every other lookup in this index.
  //
  // Two real vcFunding rows can still collide on the same canonicalized
  // name — confirmed by hand: the AI vertical's committed data has "OpenAI"
  // twice, under two different real CapIQ ids (11140937, $174.4B/11 deals;
  // 147577523, $4.5B/1 deal) — the same "id isn't perfectly clean" gap
  // CLAUDE.md documents for Quantinuum. On a collision, keep whichever
  // record has the larger totalRaisedUsd rather than whatever the array's
  // iteration order happens to leave last — an arbitrary pick could easily
  // surface the far smaller, less complete figure for a real, well-known
  // company.
  const orgIdToVc = new Map<string, VcCompanyFunding>();
  for (const v of data.vcFunding ?? []) {
    const key = canonicalizeOrg(v.name).id;
    const existing = orgIdToVc.get(key);
    if (!existing || v.totalRaisedUsd > existing.totalRaisedUsd) orgIdToVc.set(key, v);
  }

  const tickerToLatestRd = new Map<string, { fiscalYear: number; amountUsd: number; source: "sec" | "capiq" }>();
  const latest = data.rdSpend?.[data.rdSpend.length - 1];
  if (latest) {
    for (const c of latest.companies) {
      tickerToLatestRd.set(c.symbol, { fiscalYear: latest.fiscalYear, amountUsd: c.amountUsd, source: c.source });
    }
  }

  return { orgIdToTicker, orgIdToVc, tickerToLatestRd };
}

// Returns null (not an empty object) when none of the three sources match —
// same "omit rather than fabricate" convention CompanyMarketPanel already
// follows for tickers with no market-cap data.
export function lookupOrgFinancials(index: OrgFinancialIndex, orgName: string): OrgFinancialProfile | null {
  if (!orgName) return null;
  const id = canonicalizeOrg(orgName).id;
  const ticker = index.orgIdToTicker.get(id);
  const vc = index.orgIdToVc.get(id);
  const rd = ticker ? index.tickerToLatestRd.get(ticker.symbol) : undefined;
  if (!ticker && !vc && !rd) return null;
  return { ticker, vc, rd };
}
