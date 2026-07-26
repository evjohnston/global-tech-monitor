import { useMemo } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyNode } from "d3-sankey";
import type { VcCompanyFunding } from "../lib/types.ts";
import { buildMoneyFlow, MONEY_FLOW_TOP_COMPANIES, MONEY_FLOW_TOP_INVESTORS, type MoneyFlowNode } from "../lib/moneyFlow.ts";

const WIDTH = 680;
const HEIGHT = 440;

// Real investor -> company flow (see moneyFlow.ts) rendered as a hand-drawn
// SVG sankey — d3-sankey supplies only the node/link layout math (node
// x/y positions, link curve widths), same division of labor as WorldMap.tsx
// using d3-geo purely for map projection while the actual rendering stays
// plain JSX/SVG. Link width is a real deal count, never a dollar figure.
export function MoneyFlowSankey({ companies }: { companies: VcCompanyFunding[] }) {
  const flow = useMemo(() => buildMoneyFlow(companies), [companies]);

  const graph = useMemo(() => {
    if (flow.nodes.length === 0 || flow.links.length === 0) return null;
    const layout = sankey<MoneyFlowNode, { value: number }>()
      .nodeId((d) => d.id)
      .nodeWidth(10)
      .nodePadding(10)
      .extent([[1, 1], [WIDTH - 1, HEIGHT - 1]]);
    return layout({
      nodes: flow.nodes.map((n) => ({ ...n })),
      links: flow.links.map((l) => ({ source: l.source, target: l.target, value: l.value })),
    });
  }, [flow]);

  if (!graph) {
    return <div className="trend-empty">Not enough overlapping deal activity yet to draw a flow diagram.</div>;
  }

  const linkPath = sankeyLinkHorizontal();

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Investor to company deal flow">
        {graph.links.map((l, i) => {
          const source = l.source as SankeyNode<MoneyFlowNode, { value: number }>;
          const target = l.target as SankeyNode<MoneyFlowNode, { value: number }>;
          const d = linkPath(l as any);
          if (!d) return null;
          return (
            <path key={i} d={d} fill="none" stroke="var(--slate)" strokeOpacity={0.32} strokeWidth={Math.max(1, l.width ?? 1)}>
              <title>{`${source.label} → ${target.label}: ${l.value} deal${l.value === 1 ? "" : "s"}`}</title>
            </path>
          );
        })}
        {graph.nodes.map((n, i) => {
          const x0 = n.x0 ?? 0, x1 = n.x1 ?? 0, y0 = n.y0 ?? 0, y1 = n.y1 ?? 0;
          const isInvestor = n.kind === "investor";
          const label = n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label;
          return (
            <g key={i}>
              <rect x={x0} y={y0} width={Math.max(1, x1 - x0)} height={Math.max(1, y1 - y0)} fill={isInvestor ? "var(--red)" : "var(--ink)"}>
                <title>{`${n.label} · ${n.dealCount} deal${n.dealCount === 1 ? "" : "s"}`}</title>
              </rect>
              <text
                x={isInvestor ? x0 - 6 : x1 + 6}
                y={(y0 + y1) / 2}
                textAnchor={isInvestor ? "end" : "start"}
                dominantBaseline="middle"
                fontSize={9.5}
                fill="var(--ink-2)"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      {(flow.omittedInvestors > 0 || flow.omittedCompanies > 0) && (
        <div className="trend-note" style={{ marginTop: 4, fontSize: 11 }}>
          Top {MONEY_FLOW_TOP_INVESTORS} investors × top {MONEY_FLOW_TOP_COMPANIES} companies by disclosed deal activity —
          {" "}+{flow.omittedInvestors} more investors, +{flow.omittedCompanies} more companies not shown.
        </div>
      )}
      <div className="cap">
        link width = real disclosed deal count between that investor and company, not a dollar amount — a syndicated
        round's full amount can't be honestly split per co-investor (see "Who's writing the checks")
      </div>
    </div>
  );
}
