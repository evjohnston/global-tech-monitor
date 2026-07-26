import type { CompanySnapshot } from "../lib/types.ts";
import { fmtUsd } from "../lib/format.ts";
import { tickerProfile, EXPOSURE_LABEL } from "../lib/companyCategory.ts";

// Real market data (Massive REST API) for a hand-picked list of public
// companies exposed to this vertical — see `tickers` in verticals.ts.
// Deliberately outside the 4-stage pipeline: a stock price is a standing
// fact about a company, not a dated research/scaling/adoption/investment
// event — this is an EXPOSURE list, never described as capital flowing
// into the technology. A table, not cards — reuses the .lb leaderboard
// table styling (see Leaderboard.tsx) since a 20-50 row list reads far
// better dense and tabular than as a wrapped grid of cards, matching this
// app's "tightened instrument" design language. No red/green up-down
// color — this app's color budget is spent on the Hoover accent and
// country hues only (see CLAUDE.md's design system); direction is
// conveyed with a +/- sign.
export function CompanyMarketPanel({ companies, verticalId, onSelect }: { companies: CompanySnapshot[]; verticalId: string; onSelect?: (name: string) => void }) {
  if (companies.length === 0) return null;
  const asOf = companies[0]?.asOf ? new Date(companies[0].asOf).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const sorted = [...companies].sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0));
  // Section 15.3: don't render a column that's entirely unavailable across
  // every tracked row (a plan-tier gap, e.g. price/today's-move sometimes
  // 403s while market cap still comes through) — a full column of dashes
  // reads as broken, not as "not on this plan tier."
  const hasPrice = sorted.some((c) => c.price != null);
  const hasChange = sorted.some((c) => c.changePercent != null);

  return (
    <div className="panel marketpanel">
      <h3>Public companies with tracked activity in this field <span className="drop">{companies.length} tickers · exposure list, not capital invested</span></h3>
      {(!hasPrice || !hasChange) && (
        <div className="trend-note" style={{ marginBottom: 6 }}>
          {!hasPrice && !hasChange ? "Price and today's move are unavailable on this data plan tier" : !hasPrice ? "Price is unavailable on this data plan tier" : "Today's move is unavailable on this data plan tier"} — market cap still comes through the reference endpoint. Last refresh: {asOf}.
        </div>
      )}
      <div className="marketpanel-scroll">
        <table className="lb">
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Ticker</th>
              <th>Company</th>
              <th>Exposure class</th>
              {hasPrice && <th className="right">Price</th>}
              <th className="right">Market cap</th>
              {hasChange && <th className="right">Today</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const profile = tickerProfile(verticalId, c.symbol);
              return (
                <tr
                  key={c.symbol}
                  className="clickable"
                  tabIndex={onSelect ? 0 : undefined}
                  onClick={() => onSelect?.(c.name)}
                  onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(c.name); } }}
                  title={`as of ${new Date(c.asOf).toLocaleString()} · ${profile.evidence} · click for details`}
                >
                  <td className="rank">{i + 1}</td>
                  <td className="org-name" style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>{c.symbol}</td>
                  <td className="org-name" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}{" "}
                    <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`${c.name} website ↗`} title="Visit company site">↗</a>
                  </td>
                  <td style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>{EXPOSURE_LABEL[profile.exposure]}</td>
                  {hasPrice && <td className="right count">{c.price != null ? `$${c.price.toFixed(2)}` : "—"}</td>}
                  <td className="right count">{c.marketCapUsd != null ? fmtUsd(c.marketCapUsd) : "—"}</td>
                  {hasChange && (
                    <td className="right count">
                      {c.changePercent != null ? `${c.changePercent >= 0 ? "+" : ""}${c.changePercent.toFixed(2)}%` : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="cap">
        market cap{hasChange ? " + today's move" : ""} · Massive REST API · as of {asOf} · not part of the innovation/scaling/adoption/investment pipeline.
        Exposure class is real, hand-researched categorization (see verticals.ts) — never a claim about how much of a diversified
        company's business is actually this technology.
      </div>
    </div>
  );
}
