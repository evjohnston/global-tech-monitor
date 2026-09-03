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
import { FindingsPanel } from "../components/FindingsPanel.tsx";
import { computeDashboardFindings } from "../lib/findingsEngine.ts";
import { tickerProfile, rdSectorsFor, RD_SECTOR_LABEL, type RdSector } from "../lib/companyCategory.ts";
import { applyExposureMode, pureplayShare, exposureBreakdown, type RdExposureMode } from "../lib/rdExposure.ts";
import { EXPOSURE_LABEL } from "../lib/companyCategory.ts";
import type { MoneyFlowView } from "../lib/urlState.ts";

type Route = "grants" | "private" | "rd" | "public";
const ROUTES: { key: Route; label: string }[] = [
  { key: "grants", label: "Public grants" },
  { key: "private", label: "Private funding" },
  { key: "rd", label: "Corporate R&D" },
  { key: "public", label: "Public companies" },
];

// Money flow default is "Attributable amount — ranked bars," never the
// Sankey — the deal-count Sankey stays available as a secondary,
// explicitly-chosen view, not the first thing a reader sees. Persisted in
// the URL (ctx.moneyFlowView) so a shared link reopens on the same view.
const FLOW_VIEWS: { key: MoneyFlowView; label: string }[] = [
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
  const { data, entries, shown, trend21, country, compareCountries, vertical, openOrgDrawer, openOrgDrawerBySymbol, openTarget, moneyFlowView: flowView, setMoneyFlowView: setFlowView } = ctx;
  const [route, setRoute] = useState<Route>("grants");
  const [rdSector, setRdSector] = useState<RdSector>("all");
  const [rdExposure, setRdExposure] = useState<RdExposureMode>("all");

  const fundingByCountryMap = useMemo(() => fundingByCountry(entries), [entries]);
  const fundingTop = useMemo(() => topCountries(fundingByCountryMap, 8), [fundingByCountryMap]);
  const fundingGrandTotal = fundingTop.top.reduce((s, c) => s + c.count, 0) + fundingTop.rest.reduce((s, c) => s + c.count, 0) || 1;
  const latestRdSpend = data?.rdSpend?.[data.rdSpend.length - 1];
  const vcTotalUsd = useMemo(() => data?.vcFunding?.reduce((s, c) => s + c.totalRaisedUsd, 0) ?? 0, [data]);
  const marketCapTotalUsd = useMemo(() => data?.companies?.reduce((s, c) => s + (c.marketCapUsd ?? 0), 0) ?? 0, [data]);
  // The newest fiscal year's companies, hoisted out of the R&D panel's own
  // IIFE so the sector chips above it can be derived from the same list
  // they filter. Without that the chip row can't know whether an
  // uncategorized company is present.
  const latestRdCompanies = useMemo(() => data?.rdSpend?.[data.rdSpend.length - 1]?.companies ?? [], [data]);
  const latestRdPoint = useMemo(() => data?.rdSpend?.[data.rdSpend.length - 1], [data]);
  // The measured overstatement. null means this vertical has no pure-play
  // public filer at all — a different statement from "their share is small",
  // and AI's real situation, so it gets its own sentence below rather than a
  // 0% that reads as a rounding artefact.
  const rdPureplay = useMemo(
    () => (latestRdPoint ? pureplayShare(vertical.id, latestRdPoint) : null),
    [latestRdPoint, vertical.id],
  );
  const rdExposureMix = useMemo(
    () => (latestRdPoint ? exposureBreakdown(vertical.id, latestRdPoint) : []),
    [latestRdPoint, vertical.id],
  );
  const rdPoints = useMemo(
    () => applyExposureMode(vertical.id, data?.rdSpend ?? [], rdExposure),
    [data, vertical.id, rdExposure],
  );

  const countryHasNoGrantCoverage = country !== "all" && fundingTop.top.every((c) => c.country !== country) && fundingTop.rest.every((c) => c.country !== country);
  // A country filter genuinely applies to Public grants (NSF entries carry
  // a real country) but NOT to the other three pools — VcCompanyFunding,
  // RdSpendPoint, and CompanySnapshot are all company-level records with
  // no country field at all (see CLAUDE.md). Silently leaving those three
  // cards showing the unfiltered global total while the grants card
  // changes would read as if all four pools respected the filter equally,
  // which isn't true — say so explicitly instead.
  const isFiltered = country !== "all";
  const countryGrantTotal = fundingByCountryMap[country] ?? 0;
  const findings = useMemo(() => computeDashboardFindings(entries, "money", country), [entries, country]);

  return (
    <div>
      <div className="kpirow">
        <KpiCard
          label={isFiltered ? `${countryName(country)} public grants` : "Public grants"}
          value={isFiltered ? (countryGrantTotal > 0 ? fmtUsd(countryGrantTotal) : "—") : fmtUsd(fundingGrandTotal)}
          caption={isFiltered ? (countryGrantTotal > 0 ? "NSF, all time — this country only" : "No comparable grant feed for this country") : "NSF, all time · US/EU only, no PRC feed"}
        />
        {data?.vcFunding && data.vcFunding.length > 0 && (
          <KpiCard label="Private funding disclosed" value={fmtUsd(vcTotalUsd)} caption={isFiltered ? "Global total — no per-company country field, filter doesn't apply" : "S&P Capital IQ · all-time"} />
        )}
        {latestRdSpend && (
          <KpiCard label="Total company R&D" value={fmtUsd(latestRdSpend.totalUsd)} caption={isFiltered ? `FY${latestRdSpend.fiscalYear} · global, filter doesn't apply` : `FY${latestRdSpend.fiscalYear} · not field-specific spending`} />
        )}
        {data?.companies && data.companies.length > 0 && (
          <KpiCard label="Public companies tracked" value={String(data.companies.length)} caption={isFiltered ? `${fmtUsd(marketCapTotalUsd)} global, filter doesn't apply` : `${fmtUsd(marketCapTotalUsd)} combined market cap`} />
        )}
        {latestRdSpend && (
          <KpiCard label="R&D-reporting companies" value={String(latestRdSpend.companies.length)} caption={`of ${data?.companies?.length ?? 0} tracked, disclosed FY${latestRdSpend.fiscalYear} R&D`} />
        )}
      </div>
      <div className="trend-note" style={{ marginBottom: 10 }}>
        Four distinct real pools, never summed into one figure — each has its own coverage, source, and definition below.
        {isFiltered && " A country filter only changes the Public grants card — the other three pools have no per-company country field to filter by."}
      </div>

      <FindingsPanel findings={findings} onOpenTarget={openTarget} />

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
                    <KpiCard label="Companies tracked" value={String(s.companiesTracked)} caption={`${s.totalDeals} total tracked rounds`} />
                  </div>
                );
              })()}
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
              <VcFundingLeaderboard companies={data.vcFunding} onSelect={openOrgDrawer} />
              <InvestorLeaderboard companies={data.vcFunding} onSelectInvestor={(name) => openTarget({ kind: "investor", name })} onSelectCompany={openOrgDrawer} />
            </>
          ) : (
            <div className="trend-empty">No private funding data imported for this vertical yet.</div>
          )}
        </div>
      )}

      {route === "rd" && (
        <div>
          {/* The caveat here used to be prose only. It is now the measured
              number, because prose lets a reader keep the headline figure in
              mind while the number replaces it. On the shipped data quantum's
              pure-play share is 0.23% of a $198.9B total — an overstatement of
              more than two orders of magnitude that no amount of hedging
              language conveys. */}
          <div className="drawer-note">
            <strong>Total company R&D among firms with tracked activity in this field.</strong> These are
            company-wide R&D totals, not {vertical.shortLabel}-specific spending, because no filer breaks
            R&D out by technology. A diversified company's budget covers far more than this one field.
            {rdPureplay ? (
              <>
                {" "}For the latest year, the {rdPureplay.companies} pure-play{rdPureplay.companies === 1 ? "" : "s"} tracked
                here account for {fmtUsd(rdPureplay.pureplayUsd)} of {fmtUsd(rdPureplay.totalUsd)} —{" "}
                <strong>{rdPureplay.sharePct < 1 ? rdPureplay.sharePct.toFixed(2) : rdPureplay.sharePct.toFixed(0)}%</strong>.
                That share is the honest measure of how much of this total is really about {vertical.shortLabel}.
              </>
            ) : (
              <>
                {" "}No public company tracked here is a pure-play in {vertical.shortLabel} — every one of them is
                diversified. There is no field-specific figure to compare against, so read this total as an
                upper bound on the sector's R&D rather than as its spending on {vertical.shortLabel}.
              </>
            )}
          </div>
          {data?.rdSpend && data.rdSpend.length > 0 ? (
            <>
              <div className="panel">
                <h3>Total company R&D over time <span className="drop">SEC + CapIQ filings</span></h3>
                {/* Only offered when a pure-play actually exists. For AI it
                    does not, and a chip that always renders an empty chart
                    would be worse than no chip. */}
                {rdPureplay && (
                  <div className="tab-bar" style={{ marginBottom: 8 }}>
                    {([["all", "All tracked companies"], ["pure-play", "Pure-play only"]] as const).map(([m, label]) => (
                      <button key={m} className="chip" aria-pressed={rdExposure === m} onClick={() => setRdExposure(m)}>{label}</button>
                    ))}
                  </div>
                )}
                {rdPoints.length >= 2 ? (
                  <RdSpendTrend points={rdPoints} />
                ) : (
                  <div className="trend-empty">
                    Too few fiscal years with a pure-play filer to plot a trend. Years with no pure-play
                    company are left out rather than shown as zero, since none of them had filed yet.
                  </div>
                )}
                {rdExposure === "pure-play" && rdPoints.length >= 2 && (
                  <div className="drawer-note">
                    {rdPoints.length} fiscal year{rdPoints.length === 1 ? "" : "s"} shown, starting FY{rdPoints[0].fiscalYear}.
                    Earlier years are absent because no pure-play company had filed yet, not because spending was zero.
                  </div>
                )}
              </div>
              <div className="panel">
                <SectionHeader
                  title="How much of that total is really this field?"
                  takeaway={
                    rdPureplay
                      ? `Pure-plays are ${rdPureplay.sharePct < 1 ? rdPureplay.sharePct.toFixed(2) : rdPureplay.sharePct.toFixed(0)}% of the latest year's tracked R&D. The rest is real spending by companies whose budgets cover far more than ${vertical.shortLabel}.`
                      : `Every tracked company is diversified, so none of this total is specific to ${vertical.shortLabel}.`
                  }
                />
                {rdExposureMix.map((slice) => (
                  <BarRow
                    key={slice.exposure}
                    label={EXPOSURE_LABEL[slice.exposure]}
                    pct={slice.sharePct}
                    color={slice.exposure === "pure-play" ? "var(--red)" : "var(--line-2)"}
                    valueLabel={`${slice.sharePct.toFixed(slice.sharePct < 1 ? 2 : 0)}%`}
                    detail={`${EXPOSURE_LABEL[slice.exposure]} · ${slice.companies} compan${slice.companies === 1 ? "y" : "ies"} · ${fmtUsd(slice.totalUsd)} total R&D`}
                  />
                ))}
              </div>
              <div className="panel">
                <SectionHeader title="Which companies report the most R&D spend?" />
                {/* The sector list is derived from the companies actually
                    being rendered, not just from the curated map, so a
                    ticker nobody has categorized yet shows up under its own
                    "Not yet categorized" chip rather than having its whole
                    R&D budget quietly counted inside a real sector. */}
                <div className="tab-bar" style={{ marginBottom: 8 }}>
                  {rdSectorsFor(vertical.id, latestRdCompanies.map((c) => c.symbol)).map((s) => (
                    <button key={s} className="chip" aria-pressed={rdSector === s} onClick={() => setRdSector(s)}>{RD_SECTOR_LABEL[s]}</button>
                  ))}
                </div>
                {(() => {
                  const latest = data.rdSpend[data.rdSpend.length - 1];
                  const filtered = rdSector === "all" ? latest.companies : latest.companies.filter((c) => tickerProfile(vertical.id, c.symbol).sector === rdSector);
                  const sorted = [...filtered].sort((a, b) => b.amountUsd - a.amountUsd);
                  if (sorted.length === 0) return <div className="trend-empty">No tracked companies in this sector for {vertical.shortLabel}.</div>;
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
            <CompanyMarketPanel companies={data.companies} verticalId={vertical.id} onSelect={openOrgDrawer} />
          ) : (
            <div className="trend-empty">No public-market data available for this vertical's tracked tickers.</div>
          )}
        </div>
      )}
    </div>
  );
}
