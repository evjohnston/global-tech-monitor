import type { VcCompanyFunding } from "./types.ts";
import { canonicalizeOrg } from "./entityResolution.ts";

export interface MoneyFlowNode {
  id: string;
  label: string;
  kind: "investor" | "company";
  dealCount: number;
}

export interface MoneyFlowLink {
  source: string;
  target: string;
  value: number; // real deal count between this investor and this company — never a dollar amount, see note below
}

export interface MoneyFlowData {
  nodes: MoneyFlowNode[];
  links: MoneyFlowLink[];
  omittedInvestors: number;
  omittedCompanies: number;
}

export const MONEY_FLOW_TOP_INVESTORS = 12;
export const MONEY_FLOW_TOP_COMPANIES = 15;

// Real investor -> company flow, restricted to the top N companies by
// disclosed total raised (same ranking VcFundingLeaderboard uses) and the
// top M investors by deal count within that set. Link weight is a real deal
// count, deliberately NOT a dollar amount — the same reasoning
// vcInvestors.ts already documents: a syndicated round's full disclosed
// amount can't be honestly attributed to one co-investor without
// double-counting across every other investor on that round. A Sankey's
// link width just needs an honest, non-fabricated weight; deal count is
// that, dollars aren't for this data.
export function buildMoneyFlow(
  companies: VcCompanyFunding[],
  topInvestors = MONEY_FLOW_TOP_INVESTORS,
  topCompanies = MONEY_FLOW_TOP_COMPANIES
): MoneyFlowData {
  const sortedCompanies = [...companies].sort((a, b) => b.totalRaisedUsd - a.totalRaisedUsd);
  const shownCompanies = sortedCompanies.slice(0, topCompanies);

  // Nested map (investor -> companyId -> deal count) rather than a joined
  // string key — investor names and company ids can both contain arbitrary
  // characters, so any single-string delimiter risks a collision.
  const pairCounts = new Map<string, Map<string, number>>();
  const investorTotal = new Map<string, number>();
  const companyLabel = new Map<string, string>();
  const companyDealCount = new Map<string, number>();

  for (const c of shownCompanies) {
    const companyId = canonicalizeOrg(c.name).id;
    companyLabel.set(companyId, c.name);
    companyDealCount.set(companyId, (companyDealCount.get(companyId) ?? 0) + c.dealCount);
    for (const deal of c.deals) {
      for (const investor of deal.investors) {
        let byCompany = pairCounts.get(investor);
        if (!byCompany) {
          byCompany = new Map();
          pairCounts.set(investor, byCompany);
        }
        byCompany.set(companyId, (byCompany.get(companyId) ?? 0) + 1);
        investorTotal.set(investor, (investorTotal.get(investor) ?? 0) + 1);
      }
    }
  }

  const rankedInvestors = [...investorTotal.entries()].sort((a, b) => b[1] - a[1]);
  const topInvestorNames = rankedInvestors.slice(0, topInvestors).map(([name]) => name);

  const links: MoneyFlowLink[] = [];
  const linkedCompanyIds = new Set<string>();
  for (const investor of topInvestorNames) {
    for (const [companyId, value] of pairCounts.get(investor) ?? []) {
      links.push({ source: investor, target: companyId, value });
      linkedCompanyIds.add(companyId);
    }
  }

  const nodes: MoneyFlowNode[] = [
    ...topInvestorNames.map((name) => ({ id: name, label: name, kind: "investor" as const, dealCount: investorTotal.get(name) ?? 0 })),
    ...[...linkedCompanyIds].map((id) => ({ id, label: companyLabel.get(id) ?? id, kind: "company" as const, dealCount: companyDealCount.get(id) ?? 0 })),
  ];

  return {
    nodes,
    links,
    omittedInvestors: Math.max(0, rankedInvestors.length - topInvestorNames.length),
    omittedCompanies: Math.max(0, shownCompanies.length - linkedCompanyIds.size),
  };
}
