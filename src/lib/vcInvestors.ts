import type { VcCompanyFunding } from "./types.ts";
import { canonicalizeOrg } from "./entityResolution.ts";

export interface InvestorRow {
  investor: string;
  dealCount: number;
  companies: { orgId: string; name: string }[];
}

// Aggregates real investor names across every VC/growth round in
// data.vcFunding — "who's writing the checks," the counterpart to
// VcFundingLeaderboard's "who's getting the money." Deliberately does NOT
// sum dollar amounts per investor: a round's amountUsd is the whole round's
// disclosed total, and crediting that full figure to every co-investor on a
// syndicated round would double- (or triple-, or more-) count the same real
// dollars across multiple rows — the same kind of distortion this project's
// fundingByCountry/periodFunding already guard against elsewhere (see
// aggregate.ts). Deal count and distinct-companies-backed are both real,
// un-inflatable signals; a dollar total isn't, for this data.
//
// "Distinct companies backed" dedupes by canonicalizeOrg(c.name), not
// c.orgId — VcCompanyFunding.orgId is CapIQ's own raw id and can genuinely
// split one real company across two ids (confirmed by hand: the AI
// vertical's data has "OpenAI" under two separate ids — the same "id isn't
// perfectly clean" gap CLAUDE.md documents for Quantinuum). Without this,
// an investor backing both OpenAI records would be credited with two
// distinct companies instead of the one real company it actually is.
export function investorLeaderboard(companies: VcCompanyFunding[]): InvestorRow[] {
  const map = new Map<string, InvestorRow>();
  for (const c of companies) {
    const canonicalId = canonicalizeOrg(c.name).id;
    for (const deal of c.deals) {
      for (const investor of deal.investors) {
        let row = map.get(investor);
        if (!row) {
          row = { investor, dealCount: 0, companies: [] };
          map.set(investor, row);
        }
        row.dealCount++;
        if (!row.companies.some((co) => co.orgId === canonicalId)) {
          row.companies.push({ orgId: canonicalId, name: c.name });
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => b.companies.length - a.companies.length || b.dealCount - a.dealCount);
}
