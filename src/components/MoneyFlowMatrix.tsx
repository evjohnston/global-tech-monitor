import { useMemo } from "react";
import type { VcCompanyFunding } from "../lib/types.ts";
import { buildMoneyFlow, MONEY_FLOW_TOP_COMPANIES, MONEY_FLOW_TOP_INVESTORS } from "../lib/moneyFlow.ts";
import { fmtUsd } from "../lib/format.ts";

// Investor x company matrix for "Attributable disclosed amount" — the
// other half of section 7B's Sankey-amount-mode replacement. A cell shows
// a real number when a real, honestly-attributable amount exists, and
// stays visibly missing otherwise (never a fabricated zero) — "syndicated"
// specifically flags real activity this view structurally can't quantify.
export function MoneyFlowMatrix({ companies }: { companies: VcCompanyFunding[] }) {
  const countFlow = useMemo(() => buildMoneyFlow(companies, { measure: "count", topInvestors: MONEY_FLOW_TOP_INVESTORS, topCompanies: MONEY_FLOW_TOP_COMPANIES }), [companies]);
  const amountFlow = useMemo(() => buildMoneyFlow(companies, { measure: "amount", topInvestors: MONEY_FLOW_TOP_INVESTORS, topCompanies: MONEY_FLOW_TOP_COMPANIES }), [companies]);

  const investors = countFlow.nodes.filter((n) => n.kind === "investor").slice(0, 10);
  const recipients = countFlow.nodes.filter((n) => n.kind === "company").slice(0, 12);
  const amountByPair = useMemo(() => new Map(amountFlow.links.map((l) => [`${l.source}|${l.target}`, l.value])), [amountFlow]);
  const countByPair = useMemo(() => new Map(countFlow.links.map((l) => [`${l.source}|${l.target}`, l.dealCount])), [countFlow]);

  if (investors.length === 0 || recipients.length === 0) {
    return <div className="trend-empty">Not enough tracked deal activity to build a matrix.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="lb collab-matrix">
        <thead>
          <tr>
            <th>Investor \ Company</th>
            {recipients.map((c) => <th key={c.id} className="right">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {investors.map((inv) => (
            <tr key={inv.id}>
              <td className="org-name">{inv.label}</td>
              {recipients.map((c) => {
                const key = `${inv.id}|${c.id}`;
                const count = countByPair.get(key);
                const amount = amountByPair.get(key);
                if (!count) return <td key={c.id} className="right count matrix-diag">—</td>;
                return (
                  <td key={c.id} className="right count" title={`${inv.label} → ${c.label} · ${count} deal${count === 1 ? "" : "s"}`}>
                    {amount ? fmtUsd(amount) : `${count} deal${count === 1 ? "" : "s"} · syndicated`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cap">a dollar figure means a real, unsyndicated (single-investor) disclosed round · "syndicated" means real tracked deal activity exists but the amount can't be honestly attributed to this one investor · "—" means no tracked deal between this pair</div>
    </div>
  );
}
