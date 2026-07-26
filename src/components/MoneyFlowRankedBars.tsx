import { useMemo } from "react";
import type { VcCompanyFunding } from "../lib/types.ts";
import { buildMoneyFlow, MONEY_FLOW_TOP_COMPANIES, MONEY_FLOW_TOP_INVESTORS } from "../lib/moneyFlow.ts";
import { fmtUsd } from "../lib/format.ts";
import { BarRow } from "./BarRow.tsx";

// Replaces the Sankey's old "amount mode" (section 7B) — when one company
// dominates disclosed funding, a Sankey's proportional link width collapses
// into a single unreadable rectangle. Ranked bars read cleanly regardless
// of skew. "Attributable disclosed amount" is real, but deliberately
// narrow: only unsyndicated (single-investor) rounds count, since a
// syndicated round's full amount can't be honestly assigned to one investor.
export function MoneyFlowRankedBars({
  companies,
  onSelectLink,
}: {
  companies: VcCompanyFunding[];
  onSelectLink?: (investor: string, companyId: string) => void;
}) {
  const flow = useMemo(
    () => buildMoneyFlow(companies, { measure: "amount", topInvestors: MONEY_FLOW_TOP_INVESTORS, topCompanies: MONEY_FLOW_TOP_COMPANIES }),
    [companies]
  );
  const companyLabel = useMemo(() => new Map(flow.nodes.filter((n) => n.kind === "company").map((n) => [n.id, n.label])), [flow]);
  const sorted = useMemo(() => [...flow.links].sort((a, b) => b.value - a.value).slice(0, 20), [flow]);
  const max = Math.max(1, ...sorted.map((l) => l.value));

  if (sorted.length === 0) {
    return <div className="trend-empty">No unsyndicated (single-investor) rounds with a disclosed amount among the tracked top investors/companies.</div>;
  }

  return (
    <div>
      <h4 className="chart-title">Largest attributable disclosed investments</h4>
      <div className="trend-note" style={{ marginBottom: 8 }}>
        Single-investor rounds only. Syndicated round amounts are excluded because they cannot be assigned to individual investors.
      </div>
      {sorted.map((l, i) => (
        <BarRow
          key={i}
          label={`${l.source} → ${companyLabel.get(l.target) ?? l.target}`}
          pct={(l.value / max) * 100}
          color="var(--red)"
          valueLabel={fmtUsd(l.value)}
          detail={`${l.source} → ${companyLabel.get(l.target) ?? l.target} · ${fmtUsd(l.value)} attributable disclosed · ${l.dealCount} unsyndicated round${l.dealCount === 1 ? "" : "s"} · click for the source records`}
          onClick={onSelectLink ? () => onSelectLink(l.source, l.target) : undefined}
        />
      ))}
      <div className="cap">amount = real disclosed round total, only for rounds with exactly one tracked investor · deal count and disclosed amount are kept as separate measures, never implied to be summable across syndicated rounds</div>
    </div>
  );
}
