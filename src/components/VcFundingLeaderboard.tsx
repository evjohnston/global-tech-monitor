import { Fragment, useState } from "react";
import type { VcCompanyFunding } from "../lib/types.ts";
import { fmtUsd } from "../lib/format.ts";

// Real, entity-consolidated VC/growth financing data from S&P Capital IQ's
// Transactions screener (data/capiq/vc-funding.ts) — which companies are
// getting which money, not just an aggregate sector total. A manual,
// periodic import (see CLAUDE.md), not a live fetch. Capped to the top N
// by disclosed total raised — real data, not hidden, just not all
// rendered at once; the remainder's own real combined total is shown
// rather than silently dropped.
const TOP_N = 25;

export function VcFundingLeaderboard({ companies }: { companies: VcCompanyFunding[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (companies.length === 0) return null;

  const sorted = [...companies].sort((a, b) => b.totalRaisedUsd - a.totalRaisedUsd);
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const restTotal = rest.reduce((s, c) => s + c.totalRaisedUsd, 0);
  const restDeals = rest.reduce((s, c) => s + c.dealCount, 0);

  return (
    <div className="panel vcpanel">
      <h3>Who's getting the money <span className="drop">real VC/growth rounds, S&P Capital IQ</span></h3>
      <div className="marketpanel-scroll">
        <table className="lb">
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Company</th>
              <th className="right">Disclosed raised</th>
              <th className="right">Deals</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c, i) => (
              <Fragment key={c.orgId}>
                <tr
                  className={`clickable${expanded === c.orgId ? " active" : ""}`}
                  onClick={() => setExpanded(expanded === c.orgId ? null : c.orgId)}
                  title="Click to see individual rounds"
                >
                  <td className="rank">{i + 1}</td>
                  <td className="org-name">{c.name}</td>
                  <td className="right count">{fmtUsd(c.totalRaisedUsd)}</td>
                  <td className="right count">{c.dealCount}</td>
                </tr>
                {expanded === c.orgId && (
                  <tr>
                    <td></td>
                    <td colSpan={3}>
                      <div className="vc-deals">
                        {[...c.deals]
                          .sort((a, b) => (a.date < b.date ? 1 : -1))
                          .map((d, di) => (
                            <div key={di} className="vc-deal-row">
                              <span className="num">{d.date || "date undisclosed"}</span>
                              <span>{d.type}</span>
                              <span className="vc-deal-status">{d.status}</span>
                              <span className="num right">{d.amountUsd != null ? fmtUsd(d.amountUsd) : "undisclosed"}</span>
                              <span className="vc-deal-investors" title={d.investors.join(", ")}>
                                {d.investors.length > 0 ? `${d.investors.length} investor${d.investors.length > 1 ? "s" : ""}` : ""}
                              </span>
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {rest.length > 0 && (
        <div className="trend-note" style={{ marginTop: 8, fontSize: 11 }}>
          +{rest.length} more companies, {fmtUsd(restTotal)} disclosed across {restDeals} deals
        </div>
      )}
      <div className="cap">
        entity-consolidated via a real-suffix-stripping heuristic, not a guaranteed entity-ID join · deal amounts as disclosed by S&P Capital IQ, "undisclosed" is real missing data, not zero
      </div>
    </div>
  );
}
