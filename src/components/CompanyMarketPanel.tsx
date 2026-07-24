import type { CompanySnapshot } from "../lib/types.ts";
import { fmtUsd } from "../lib/format.ts";

// Real market data (Massive REST API) for a hand-picked list of public
// companies exposed to this vertical — see `tickers` in verticals.ts.
// Deliberately outside the 4-stage pipeline: a stock price is a standing
// fact about a company, not a dated research/scaling/adoption/investment
// event. No red/green up-down color — this app's color budget is spent on
// the Hoover accent and country hues only (see CLAUDE.md's design system);
// direction is conveyed with a +/- sign instead.
export function CompanyMarketPanel({ companies }: { companies: CompanySnapshot[] }) {
  if (companies.length === 0) return null;
  const asOf = companies[0]?.asOf ? new Date(companies[0].asOf).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <div className="panel marketpanel">
      <h3>Public markets · companies exposed to this vertical</h3>
      <div className="marketrow">
        {companies.map((c) => (
          <a key={c.symbol} className="marketcard" href={c.url} target="_blank" rel="noopener noreferrer" title={`as of ${new Date(c.asOf).toLocaleString()}`}>
            <span className="marketcard-sym">{c.symbol}</span>
            <span className="marketcard-name">{c.name}</span>
            <span className="marketcard-cap num">{c.marketCapUsd != null ? fmtUsd(c.marketCapUsd) : "—"}</span>
            {c.changePercent != null && (
              <span className="marketcard-chg num">{c.changePercent >= 0 ? "+" : ""}{c.changePercent.toFixed(2)}%</span>
            )}
          </a>
        ))}
      </div>
      <div className="cap">market cap + today's move · Massive REST API · as of {asOf} · not part of the innovation/scaling/adoption/investment pipeline</div>
    </div>
  );
}
