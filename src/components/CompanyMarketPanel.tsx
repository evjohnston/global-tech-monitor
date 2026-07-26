import type { CompanySnapshot } from "../lib/types.ts";
import { fmtUsd } from "../lib/format.ts";

// Real market data (Massive REST API) for a hand-picked list of public
// companies exposed to this vertical — see `tickers` in verticals.ts.
// Deliberately outside the 4-stage pipeline: a stock price is a standing
// fact about a company, not a dated research/scaling/adoption/investment
// event. A table, not cards — reuses the .lb leaderboard table styling
// (see Leaderboard.tsx) since a 20-50 row list reads far better dense and
// tabular than as a wrapped grid of cards, matching this app's "tightened
// instrument" design language. No red/green up-down color — this app's
// color budget is spent on the Hoover accent and country hues only (see
// CLAUDE.md's design system); direction is conveyed with a +/- sign.
export function CompanyMarketPanel({ companies, onSelect }: { companies: CompanySnapshot[]; onSelect?: (name: string) => void }) {
  if (companies.length === 0) return null;
  const asOf = companies[0]?.asOf ? new Date(companies[0].asOf).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const sorted = [...companies].sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0));

  return (
    <div className="panel marketpanel">
      <h3>Public markets · companies exposed to this vertical <span className="drop">{companies.length} tickers</span></h3>
      <div className="marketpanel-scroll">
        <table className="lb">
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Ticker</th>
              <th>Company</th>
              <th className="right">Price</th>
              <th className="right">Market cap</th>
              <th className="right">Today</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.symbol}
                className="clickable"
                tabIndex={onSelect ? 0 : undefined}
                onClick={() => onSelect?.(c.name)}
                onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(c.name); } }}
                title={`as of ${new Date(c.asOf).toLocaleString()} · click for details`}
              >
                <td className="rank">{i + 1}</td>
                <td className="org-name" style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>{c.symbol}</td>
                <td className="org-name" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}{" "}
                  <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`${c.name} website ↗`} title="Visit company site">↗</a>
                </td>
                <td className="right count">{c.price != null ? `$${c.price.toFixed(2)}` : "—"}</td>
                <td className="right count">{c.marketCapUsd != null ? fmtUsd(c.marketCapUsd) : "—"}</td>
                <td className="right count">
                  {c.changePercent != null ? `${c.changePercent >= 0 ? "+" : ""}${c.changePercent.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cap">market cap + today's move · Massive REST API · as of {asOf} · not part of the innovation/scaling/adoption/investment pipeline</div>
    </div>
  );
}
