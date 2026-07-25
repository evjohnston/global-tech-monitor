import { Fragment, useState } from "react";
import type { VcCompanyFunding } from "../lib/types.ts";
import { investorLeaderboard } from "../lib/vcInvestors.ts";

// Real investor names from S&P Capital IQ's Transactions data — "who's
// writing the checks," the counterpart to VcFundingLeaderboard's "who's
// getting the money." Same top-N + real "rest" rollup + click-to-expand
// pattern as VcFundingLeaderboard, reusing the same .lb table styling.
const TOP_N = 25;

export function InvestorLeaderboard({ companies }: { companies: VcCompanyFunding[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = investorLeaderboard(companies);
  if (rows.length === 0) return null;

  const top = rows.slice(0, TOP_N);
  const rest = rows.slice(TOP_N);

  return (
    <div className="panel vcpanel">
      <h3>Who's writing the checks <span className="drop">investors by real deal activity, S&P Capital IQ</span></h3>
      <div className="marketpanel-scroll">
        <table className="lb">
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Investor</th>
              <th className="right">Deals</th>
              <th className="right">Companies backed</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r, i) => (
              <Fragment key={r.investor}>
                <tr
                  className={`clickable${expanded === r.investor ? " active" : ""}`}
                  onClick={() => setExpanded(expanded === r.investor ? null : r.investor)}
                  title="Click to see companies backed"
                >
                  <td className="rank">{i + 1}</td>
                  <td className="org-name">{r.investor}</td>
                  <td className="right count">{r.dealCount}</td>
                  <td className="right count">{r.companies.length}</td>
                </tr>
                {expanded === r.investor && (
                  <tr>
                    <td></td>
                    <td colSpan={3}>
                      <div className="vc-deals">
                        {r.companies.map((co) => (
                          <div key={co.orgId} className="vc-deal-row">
                            <span>{co.name}</span>
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
          +{rest.length} more investors with fewer disclosed deals
        </div>
      )}
      <div className="cap">
        deal counts and companies backed are real activity signals · dollar totals aren't shown here since a syndicated round's disclosed amount would otherwise be double-counted across every co-investor
      </div>
    </div>
  );
}
