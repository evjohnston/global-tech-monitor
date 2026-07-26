import type { VcCompanyFunding, VcDeal } from "./types.ts";
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
  value: number; // real deal count OR real unsyndicated disclosed amount, see buildMoneyFlow
  dealCount: number; // always the real deal count, regardless of `measure` — for tooltips
}

export interface MoneyFlowData {
  nodes: MoneyFlowNode[];
  links: MoneyFlowLink[];
  omittedInvestors: number;
  omittedCompanies: number;
}

export const MONEY_FLOW_TOP_INVESTORS = 12;
export const MONEY_FLOW_TOP_COMPANIES = 15;

export interface MoneyFlowOptions {
  topInvestors?: number;
  topCompanies?: number;
  // "count" (default) weights a link by real deal count. "amount" weights
  // it by real disclosed dollars, but ONLY from unsyndicated deals (exactly
  // one investor) — a syndicated round's full amount can't be honestly
  // attributed to one co-investor without double-counting across the
  // others (same reasoning vcInvestors.ts documents), so syndicated deals
  // simply don't contribute to "amount" mode rather than being force-split.
  measure?: "count" | "amount";
  from?: string | null;
  to?: string | null;
}

// Real investor -> company flow, restricted to the top N companies by
// disclosed total raised (same ranking VcFundingLeaderboard uses) and the
// top M investors by deal count within that set.
export function buildMoneyFlow(companies: VcCompanyFunding[], opts: MoneyFlowOptions = {}): MoneyFlowData {
  const { topInvestors = MONEY_FLOW_TOP_INVESTORS, topCompanies = MONEY_FLOW_TOP_COMPANIES, measure = "count", from, to } = opts;
  const inRange = (d: VcDeal) => (!from || !d.date || d.date >= from) && (!to || !d.date || d.date <= to);

  const sortedCompanies = [...companies].sort((a, b) => b.totalRaisedUsd - a.totalRaisedUsd);
  const shownCompanies = sortedCompanies.slice(0, topCompanies);

  // Nested map (investor -> companyId -> {count, amount}) rather than a
  // joined string key — investor names and company ids can both contain
  // arbitrary characters, so any single-string delimiter risks a collision.
  const pairStats = new Map<string, Map<string, { count: number; amount: number }>>();
  const investorTotal = new Map<string, number>();
  const companyLabel = new Map<string, string>();
  const companyDealCount = new Map<string, number>();

  for (const c of shownCompanies) {
    const companyId = canonicalizeOrg(c.name).id;
    companyLabel.set(companyId, c.name);
    const dealsInRange = c.deals.filter(inRange);
    companyDealCount.set(companyId, (companyDealCount.get(companyId) ?? 0) + dealsInRange.length);
    for (const deal of dealsInRange) {
      const unsyndicatedAmount = deal.investors.length === 1 && deal.amountUsd != null ? deal.amountUsd : 0;
      for (const investor of deal.investors) {
        let byCompany = pairStats.get(investor);
        if (!byCompany) {
          byCompany = new Map();
          pairStats.set(investor, byCompany);
        }
        const cur = byCompany.get(companyId) ?? { count: 0, amount: 0 };
        cur.count += 1;
        cur.amount += unsyndicatedAmount;
        byCompany.set(companyId, cur);
        investorTotal.set(investor, (investorTotal.get(investor) ?? 0) + 1);
      }
    }
  }

  const rankedInvestors = [...investorTotal.entries()].sort((a, b) => b[1] - a[1]);
  const topInvestorNames = rankedInvestors.slice(0, topInvestors).map(([name]) => name);

  const links: MoneyFlowLink[] = [];
  const linkedCompanyIds = new Set<string>();
  for (const investor of topInvestorNames) {
    for (const [companyId, stats] of pairStats.get(investor) ?? []) {
      const value = measure === "amount" ? stats.amount : stats.count;
      if (value <= 0) continue; // an amount-mode pair with only syndicated deals has nothing honest to show
      links.push({ source: investor, target: companyId, value, dealCount: stats.count });
      linkedCompanyIds.add(companyId);
    }
  }

  const nodes: MoneyFlowNode[] = [
    ...topInvestorNames.filter((name) => linkedCompanyIds.size > 0 && links.some((l) => l.source === name)).map((name) => ({ id: name, label: name, kind: "investor" as const, dealCount: investorTotal.get(name) ?? 0 })),
    ...[...linkedCompanyIds].map((id) => ({ id, label: companyLabel.get(id) ?? id, kind: "company" as const, dealCount: companyDealCount.get(id) ?? 0 })),
  ];

  return {
    nodes,
    links,
    omittedInvestors: Math.max(0, rankedInvestors.length - topInvestorNames.length),
    omittedCompanies: Math.max(0, shownCompanies.length - linkedCompanyIds.size),
  };
}

// Real underlying deals for one Sankey link (a specific investor-company
// pair) — feeds the metadata drawer / "open underlying transactions" click,
// and the Sankey link tooltip's disclosed-amount/date/round-type fields.
export function dealsForLink(companies: VcCompanyFunding[], investor: string, companyId: string): { company: VcCompanyFunding; deals: VcDeal[] } | null {
  const company = companies.find((c) => canonicalizeOrg(c.name).id === companyId);
  if (!company) return null;
  const deals = company.deals.filter((d) => d.investors.includes(investor));
  return { company, deals };
}
