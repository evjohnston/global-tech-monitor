import type { RdSpendPoint } from "../lib/types.ts";
import { fmtUsd } from "../lib/format.ts";

// Per-company breakdown of RdSpendTrend's latest fiscal-year total — the
// same real companies[].amountUsd data the trend chart's tooltip only ever
// summarized as a count, one row per ticker, source-tagged (sec vs capiq,
// see CLAUDE.md's "Foreign R&D spend" section for why both exist).
export function RdSpendBreakdown({ points }: { points: RdSpendPoint[] }) {
  if (points.length === 0) return null;
  const latest = points[points.length - 1];
  const sorted = [...latest.companies].sort((a, b) => b.amountUsd - a.amountUsd);

  return (
    <div className="panel">
      <h3>R&D spend by company <span className="drop">FY{latest.fiscalYear}</span></h3>
      <table className="lb">
        <thead>
          <tr>
            <th>Ticker</th>
            <th className="right">R&D spend</th>
            <th className="right">Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.symbol}>
              <td className="org-name" style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>{c.symbol}</td>
              <td className="right count">{fmtUsd(c.amountUsd)}</td>
              <td className="right count" style={{ textTransform: "uppercase", fontSize: 9.5 }}>{c.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cap">sec = SEC EDGAR XBRL filing · capiq = S&P Capital IQ import (foreign 20-F filers SEC can't reach)</div>
    </div>
  );
}
