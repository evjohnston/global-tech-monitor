import { useMemo, useState } from "react";
import type { DashboardContext } from "./types.ts";
import { fundingByCountry, topCountries } from "../lib/aggregate.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { fmtUsd } from "../lib/format.ts";
import { privateFundingSummary } from "../lib/vcInvestors.ts";
import { KpiCard } from "../components/KpiCard.tsx";
import { BarRow } from "../components/BarRow.tsx";
import { FundingTrend } from "../components/FundingTrend.tsx";
import { RdSpendTrend } from "../components/RdSpendTrend.tsx";
import { RdSpendBreakdown } from "../components/RdSpendBreakdown.tsx";
import { AwardSizeHistogram } from "../components/AwardSizeHistogram.tsx";
import { CompanyMarketPanel } from "../components/CompanyMarketPanel.tsx";
import { VcFundingLeaderboard } from "../components/VcFundingLeaderboard.tsx";
import { InvestorLeaderboard } from "../components/InvestorLeaderboard.tsx";
import { MoneyFlowSankey } from "../components/MoneyFlowSankey.tsx";
import { MoneyFlowRankedBars } from "../components/MoneyFlowRankedBars.tsx";
import { MoneyFlowMatrix } from "../components/MoneyFlowMatrix.tsx";
import { MethodNote } from "../components/MethodNote.tsx";
import { SectionHeader } from "../components/ChartFrame.tsx";

type Route = "grants" | "private" | "rd" | "public";
const ROUTES: { key: Route; label: string }[] = [
  { key: "grants", label: "Public grants" },
  { key: "private", label: "Private funding" },
  { key: "rd", label: "Corporate R&D" },
  { key: "public", label: "Public companies" },
];

// Money flow default is "Attributable amount — ranked bars," never the
// Sankey — the deal-count Sankey stays available as a secondary,
// explicitly-chosen view, not the first thing a reader sees.
type FlowView = "amount-bars" | "count" | "amount-matrix";
const FLOW_VIEWS: { key: FlowView; label: string }[] = [
  { key: "amount-bars", label: "Attributable amount (ranked bars)" },
  { key: "count", label: "Deal count (flow)" },
  { key: "amount-matrix", label: "Attributable amount (matrix)" },
];

// Money is deliberately its own dashboard, with 4 sub-routes that are never
// summed or implied to be comparable — public grants, private funding,
// corporate R&D, and public-market exposure are four distinct real pools
// with different sources, coverage, and meaning (see CLAUDE.md's standing
// rule against blending them into one figure).
export function TrackMoney({ ctx }: { ctx: DashboardContext }) {
  const { data, entries, shown, trend21, country, compareCountries, openOrgDrawer, openOrgDrawerBySymbol, openTarget } = ctx;
  const [route, setRoute] = useState<Route>("grants");
  const [flowView, setFlowView] = useState<FlowView>("amount-bars");

  const fundingTop = useMemo(() => topCountries(fundingByCountry(entries), 8), [entries]);
  const fundingGrandTotal = fundingTop.top.reduce((s, c) => s + c.count, 0) + fundingTop.rest.reduce((s, c) => s + c.count, 0) || 1;
  const latestRdSpend = data?.rdSpend?.[data.rdSpend.length - 1];
  const vcTotalUsd = useMemo(() => data?.vcFunding?.reduce((s, c) => s + c.totalRaisedUsd, 0) ?? 0, [data]);
  const marketCapTotalUsd = useMemo(() => data?.companies?.reduce((s, c) => s + (c.marketCapUsd ?? 0), 0) ?? 0, [data]);

  const countryHasNoGrantCoverage = country !== "all" && fundingTop.top.every((c) => c.country !== country) && fundingTop.rest.every((c) => c.country !== country);

  return (
    <div>
      <div className="kpirow">
        <KpiCard label="Public grants" value={fmtUsd(fundingTop.top.reduce((s, c) => s + c.count, 0) + fundingTop.rest.reduce((s, c) => s + c.count, 0))} caption="NSF, all time · US/EU only, no PRC feed" />
        {data?.vcFunding && data.vcFunding.length > 0 && <KpiCard label="Private funding disclosed" value={fmtUsd(vcTotalUsd)} caption="S&P Capital IQ · all-time" />}
        {latestRdSpend && <KpiCard label="Total company R&D" value={fmtUsd(latestRdSpend.totalUsd)} caption={`FY${latestRdSpend.fiscalYear} · not field-specific spending`} />}
        {data?.companies && data.companies.length > 0 && <KpiCard label="Public companies tracked" value={String(data.companies.length)} caption={`${fmtUsd(marketCapTotalUsd)} combined market cap`} />}
      </div>
      <div className="trend-note" style={{ marginBottom: 10 }}>
        Four distinct real pools, never summed into one figure — each has its own coverage, source, and definition below.
      </div>

      <div className="tab-bar" style={{ marginBottom: 14 }}>
        {ROUTES.map((r) => <button key={r.key} className="chip" aria-pressed={route === r.key} onClick={() => setRoute(r.key)}>{r.label}</button>)}
      </div>

      {route === "grants" && (
        <div>
          <div className="drawer-note">Definition: NSF Awards API grants, US-only (no comparable public feed exists for China's NSFC or most other countries' public research funding).</div>
          {countryHasNoGrantCoverage && (
            <div className="panel" style={{ borderColor: "var(--red)" }}>
              No comparable grant feed is available for {countryName(country)} in this dataset — NSF's coverage is US-only by construction.
            </div>
          )}
          <div className="panel">
            <h3>Awards over time <span className="drop">NSF, trailing 21d, recorded daily</span></h3>
            <FundingTrend trend={trend21} />
          </div>
          <div className="row3">
            <div className="panel">
              <h3>By country</h3>
              {fundingTop.top.length === 0 ? <div className="trend-empty">No disclosed funding yet.</div> : fundingTop.top.map((c) => (
                <BarRow key={c.country} label={countryName(c.country)} pct={(c.count / fundingGrandTotal) * 100} color={countryColor(c.country)} valueLabel={fmtUsd(c.count)} detail={`${countryName(c.country)} · ${fmtUsd(c.count)} disclosed`} faded={!!compareCountries.length && !compareCountries.includes(c.country)} />
              ))}
            </div>
            <div className="panel">
              <h3>Award size distribution</h3>
              <div className="trend-note" style={{ marginBottom: 4 }}>NSF grants only · private hyperscaler capex not shown and dwarfs this</div>
              <AwardSizeHistogram entries={shown} />
            </div>
          </div>
        </div>
      )}

      {route === "private" && (
        <div>
          <div className="drawer-note">Definition: S&P Capital IQ Transactions, real VC/growth financing rounds. Deal count and disclosed amount are kept as separate measures — an undisclosed amount is real missing data, not zero.</div>
          {data?.vcFunding && data.vcFunding.length > 0 ? (
            <>
              {(() => {
                const s = privateFundingSummary(data.vcFunding);
                return (
                  <div className="kpirow" style={{ marginTop: 10 }}>
                    <KpiCard label="Largest disclosed recipient" value={s.largestRecipient?.name ?? "—"} caption={s.largestRecipient ? fmtUsd(s.largestRecipient.totalRaisedUsd) + " disclosed" : "no disclosed rounds yet"} />
                    <KpiCard label="Most deals (recipient)" value={s.mostDealsRecipient?.name ?? "—"} caption={s.mostDealsRecipient ? `${s.mostDealsRecipient.dealCount} rounds` : "no data yet"} />
                    <KpiCard label="Most deals (investor)" value={s.mostDealsInvestor?.investor ?? "—"} caption={s.mostDealsInvestor ? `${s.mostDealsInvestor.dealCount} deals` : "no data yet"} />
                    <KpiCard label="Top 5 recipients' share" value={s.topFiveSharePct != null ? `${s.topFiveSharePct.toFixed(0)}%` : "—"} caption="of disclosed totals" />
                  </div>
                );
              })()}
              <VcFundingLeaderboard companies={data.vcFunding} onSelect={openOrgDrawer} />
              <InvestorLeaderboard companies={data.vcFunding} onSelectInvestor={(name) => openTarget({ kind: "investor", name })} onSelectCompany={openOrgDrawer} />
              <div className="panel">
                <SectionHeader
                  title="How does money flow from investors to companies?"
                  note={<MethodNote>Deal-count flow uses the full real Sankey. Amount views only count unsyndicated (single-investor) rounds — a syndicated round's amount can't be honestly split per co-investor.</MethodNote>}
                />
                <div className="tab-bar">
                  {FLOW_VIEWS.map((v) => (
                    <button key={v.key} className="chip" aria-pressed={flowView === v.key} onClick={() => setFlowView(v.key)}>{v.label}</button>
                  ))}
                </div>
                {flowView === "count" && (
                  <MoneyFlowSankey
                    companies={data.vcFunding}
                    onSelectInvestor={(name) => openTarget({ kind: "investor", name })}
                    onSelectCompany={openOrgDrawer}
                    onSelectLink={(investor, companyId) => openTarget({ kind: "sankeyLink", investor, companyId })}
                  />
                )}
                {flowView === "amount-bars" && <MoneyFlowRankedBars companies={data.vcFunding} onSelectLink={(investor, companyId) => openTarget({ kind: "sankeyLink", investor, companyId })} />}
                {flowView === "amount-matrix" && <MoneyFlowMatrix companies={data.vcFunding} />}
              </div>
            </>
          ) : (
            <div className="trend-empty">No private funding data imported for this vertical yet.</div>
          )}
        </div>
      )}

      {route === "rd" && (
        <div>
          <div className="drawer-note">
            <strong>Total company R&D among firms with tracked activity in this field.</strong> These are company-wide R&D totals, not estimated Quantum- or AI-specific spending — a diversified company's real total R&D budget covers far more than this one field.
          </div>
          {data?.rdSpend && data.rdSpend.length > 0 ? (
            <>
              <div className="panel">
                <h3>Total company R&D over time <span className="drop">SEC + CapIQ filings</span></h3>
                <RdSpendTrend points={data.rdSpend} />
              </div>
              <div className="panel">
                <SectionHeader title="Which companies report the most R&D spend?" />
                {(() => {
                  const latest = data.rdSpend[data.rdSpend.length - 1];
                  const sorted = [...latest.companies].sort((a, b) => b.amountUsd - a.amountUsd);
                  const max = Math.max(1, ...sorted.map((c) => c.amountUsd));
                  return sorted.map((c) => (
                    <BarRow
                      key={c.symbol}
                      label={c.symbol}
                      pct={(c.amountUsd / max) * 100}
                      color="var(--red)"
                      valueLabel={fmtUsd(c.amountUsd)}
                      detail={`${c.symbol} · ${fmtUsd(c.amountUsd)} R&D, FY${latest.fiscalYear} · source: ${c.source} · click for company details`}
                      onClick={() => openOrgDrawerBySymbol(c.symbol)}
                    />
                  ));
                })()}
              </div>
              <div className="panel">
                <h3>By company, all years</h3>
                <RdSpendBreakdown points={data.rdSpend} onSelect={openOrgDrawerBySymbol} />
              </div>
            </>
          ) : (
            <div className="trend-empty">No R&D spend data available for this vertical's tracked companies.</div>
          )}
        </div>
      )}

      {route === "public" && (
        <div>
          <div className="drawer-note">
            <strong>Public companies with tracked activity in this field.</strong> Market capitalization is a standing fact about a company, not capital flowing into the technology — this is an exposure list, not an investment total.
          </div>
          {data?.companies && data.companies.length > 0 ? (
            <CompanyMarketPanel companies={data.companies} onSelect={openOrgDrawer} />
          ) : (
            <div className="trend-empty">No public-market data available for this vertical's tracked tickers.</div>
          )}
        </div>
      )}
    </div>
  );
}
