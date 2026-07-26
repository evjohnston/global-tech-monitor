import { useMemo, useState } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyNode } from "d3-sankey";
import type { VcCompanyFunding } from "../lib/types.ts";
import { buildMoneyFlow, MONEY_FLOW_TOP_COMPANIES, MONEY_FLOW_TOP_INVESTORS, type MoneyFlowNode } from "../lib/moneyFlow.ts";
import { fmtUsd } from "../lib/format.ts";
import { usePrefersReducedMotion } from "../lib/useReducedMotion.ts";
import { Tooltip } from "./Tooltip.tsx";

const WIDTH = 680;
const HEIGHT = 440;

// Real investor -> company flow (see moneyFlow.ts) rendered as a hand-drawn
// SVG sankey — d3-sankey supplies only the node/link layout math (node
// x/y positions, link curve widths), same division of labor as WorldMap.tsx
// using d3-geo purely for map projection while the actual rendering stays
// plain JSX/SVG.
//
// Default state is readable before interaction: links start in a neutral
// gray, only endpoint nodes carry the color budget. Hovering a node lights
// up its own links and fades everything else; hovering/pinning a link does
// the same for just that one path. Moving particles (native SVG
// <animateMotion>, not a JS animation loop) only render on the currently
// active link(s), at a fixed duration regardless of link size — density can
// scale with a link's real weight, speed never does, so a thicker link
// never reads as "money moving faster."
export function MoneyFlowSankey({
  companies,
  emphasize,
  measure: controlledMeasure,
  onMeasureChange,
  onSelectInvestor,
  onSelectCompany,
  onSelectLink,
}: {
  companies: VcCompanyFunding[];
  emphasize?: string[];
  measure?: "count" | "amount";
  onMeasureChange?: (measure: "count" | "amount") => void;
  onSelectInvestor?: (name: string) => void;
  onSelectCompany?: (name: string) => void;
  onSelectLink?: (investor: string, companyId: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [localMeasure, setLocalMeasure] = useState<"count" | "amount">("count");
  const measure = controlledMeasure ?? localMeasure;
  const setMeasure = onMeasureChange ?? setLocalMeasure;
  const [particlesOn, setParticlesOn] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  const flow = useMemo(
    () => buildMoneyFlow(companies, { measure, topInvestors: expanded ? MONEY_FLOW_TOP_INVESTORS * 2 : MONEY_FLOW_TOP_INVESTORS, topCompanies: expanded ? MONEY_FLOW_TOP_COMPANIES * 2 : MONEY_FLOW_TOP_COMPANIES }),
    [companies, measure, expanded]
  );

  const graph = useMemo(() => {
    if (flow.nodes.length === 0 || flow.links.length === 0) return null;
    const layout = sankey<MoneyFlowNode, { value: number; dealCount: number }>()
      .nodeId((d) => d.id)
      .nodeWidth(10)
      .nodePadding(10)
      .extent([[1, 1], [WIDTH - 1, HEIGHT - 1]]);
    return layout({
      nodes: flow.nodes.map((n) => ({ ...n })),
      links: flow.links.map((l) => ({ source: l.source, target: l.target, value: l.value, dealCount: l.dealCount })),
    });
  }, [flow]);

  if (!graph) {
    return <div className="trend-empty">Not enough overlapping deal activity yet to draw a flow diagram{measure === "amount" ? " with disclosed, unsyndicated amounts" : ""}.</div>;
  }

  const linkPath = sankeyLinkHorizontal();
  const maxValue = Math.max(1, ...graph.links.map((l) => l.value));

  function isLinkActive(i: number, source: string, target: string): boolean {
    if (hoverLink != null) return hoverLink === i;
    if (hoverNode) return source === hoverNode || target === hoverNode;
    return false;
  }
  const anyHover = hoverNode != null || hoverLink != null;

  return (
    <div>
      <div className="tab-bar">
        <button className="chip" aria-pressed={measure === "count"} onClick={() => setMeasure("count")}>Deal count</button>
        <button className="chip" aria-pressed={measure === "amount"} onClick={() => setMeasure("amount")}>Disclosed amount</button>
        <button className="chip" aria-pressed={particlesOn} onClick={() => setParticlesOn((p) => !p)}>Particles {particlesOn ? "on" : "off"}</button>
        {(flow.omittedInvestors > 0 || flow.omittedCompanies > 0 || expanded) && (
          <button className="chip" aria-pressed={expanded} onClick={() => setExpanded((e) => !e)}>{expanded ? "Show fewer" : "Show more"}</button>
        )}
        <button className="chip" onClick={() => { setHoverNode(null); setHoverLink(null); }}>Reset</button>
      </div>
      {measure === "amount" && (
        <div className="trend-note" style={{ marginBottom: 6 }}>
          Amount mode only counts unsyndicated (single-investor) rounds — a syndicated round's amount can't be honestly split per co-investor.
        </div>
      )}
      <div className="sankey-scroll">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} style={{ minWidth: WIDTH, maxWidth: "100%" }} height={HEIGHT} role="img" aria-label="Investor to company deal flow">
        {graph.links.map((l, i) => {
          const source = l.source as SankeyNode<MoneyFlowNode, { value: number; dealCount: number }>;
          const target = l.target as SankeyNode<MoneyFlowNode, { value: number; dealCount: number }>;
          const d = linkPath(l as never);
          if (!d) return null;
          const active = isLinkActive(i, source.id, target.id);
          const compareFaded = !!emphasize?.length; // country emphasize doesn't map onto investor/company nodes — no-op here, kept for prop-shape consistency
          void compareFaded;
          const width = Math.max(1, l.width ?? 1);
          const particleCount = particlesOn && !reducedMotion && active ? Math.max(1, Math.round(Math.sqrt(l.value / maxValue) * 3)) : 0;
          return (
            <g key={i}>
              <path
                id={`sankey-link-${i}`}
                d={d}
                fill="none"
                stroke={active ? "var(--red)" : "var(--slate)"}
                strokeOpacity={anyHover ? (active ? 0.85 : 0.07) : 0.32}
                strokeWidth={active ? width + 1.5 : width}
                style={{ cursor: onSelectLink ? "pointer" : "default", transition: "stroke-opacity 0.15s, stroke-width 0.15s" }}
                role={onSelectLink ? "button" : undefined}
                tabIndex={onSelectLink ? 0 : undefined}
                aria-label={onSelectLink ? `${source.label} to ${target.label}, ${l.dealCount} deals` : undefined}
                onMouseEnter={() => setHoverLink(i)}
                onMouseLeave={() => { setHoverLink(null); setTip(null); }}
                onMouseMove={(e) =>
                  setTip({
                    x: e.clientX,
                    y: e.clientY,
                    content: (
                      <>
                        <div style={{ fontWeight: 600 }}>{source.label} → {target.label}</div>
                        <div>{l.dealCount} tracked deal{l.dealCount === 1 ? "" : "s"}</div>
                        {measure === "amount" && <div>{fmtUsd(l.value)} disclosed (unsyndicated rounds only)</div>}
                        <div style={{ color: "var(--mist)", fontSize: 10 }}>S&P Capital IQ · click for the underlying transactions</div>
                      </>
                    ),
                  })
                }
                onClick={() => onSelectLink?.(source.id, target.id)}
                onKeyDown={(e) => { if (onSelectLink && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelectLink(source.id, target.id); } }}
              />
              {Array.from({ length: particleCount }).map((_, pi) => (
                <circle key={pi} r={2.2} fill="var(--red)">
                  <animateMotion dur="1.6s" repeatCount="indefinite" begin={`${(pi * 1.6) / particleCount}s`}>
                    <mpath href={`#sankey-link-${i}`} />
                  </animateMotion>
                </circle>
              ))}
            </g>
          );
        })}
        {graph.nodes.map((n, i) => {
          const x0 = n.x0 ?? 0, x1 = n.x1 ?? 0, y0 = n.y0 ?? 0, y1 = n.y1 ?? 0;
          const isInvestor = n.kind === "investor";
          const label = n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label;
          const isHovered = hoverNode === n.id;
          const faded = anyHover && !isHovered && hoverLink == null;
          const onSelect = isInvestor ? onSelectInvestor : onSelectCompany;
          return (
            <g
              key={i}
              opacity={faded ? 0.35 : 1}
              style={{ cursor: onSelect ? "pointer" : "default", outline: "none" }}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={onSelect ? `${n.label}, ${n.dealCount} deals` : undefined}
              onMouseEnter={() => setHoverNode(n.id)}
              onMouseLeave={() => { setHoverNode(null); setTip(null); }}
              onMouseMove={(e) =>
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  content: (
                    <>
                      <div style={{ fontWeight: 600 }}>{n.label}</div>
                      <div>{n.dealCount} tracked deal{n.dealCount === 1 ? "" : "s"}</div>
                      <div style={{ color: "var(--mist)", fontSize: 10 }}>{isInvestor ? "Investor" : "Company"} · S&P Capital IQ, top {isInvestor ? MONEY_FLOW_TOP_INVESTORS : MONEY_FLOW_TOP_COMPANIES}-by-activity only</div>
                    </>
                  ),
                })
              }
              onClick={() => onSelect?.(n.id)}
              onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(n.id); } }}
            >
              <rect x={x0} y={y0} width={Math.max(1, x1 - x0)} height={Math.max(1, y1 - y0)} fill={isInvestor ? "var(--red)" : "var(--ink)"} />
              <text
                x={isInvestor ? x0 - 6 : x1 + 6}
                y={(y0 + y1) / 2}
                textAnchor={isInvestor ? "end" : "start"}
                dominantBaseline="middle"
                fontSize={9.5}
                fontWeight={isHovered ? 700 : 400}
                fill="var(--ink-2)"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
      {tip && <Tooltip x={tip.x} y={tip.y}>{tip.content}</Tooltip>}
      {(flow.omittedInvestors > 0 || flow.omittedCompanies > 0) && (
        <div className="trend-note" style={{ marginTop: 4, fontSize: 11 }}>
          Top {expanded ? MONEY_FLOW_TOP_INVESTORS * 2 : MONEY_FLOW_TOP_INVESTORS} investors × top {expanded ? MONEY_FLOW_TOP_COMPANIES * 2 : MONEY_FLOW_TOP_COMPANIES} companies by disclosed deal activity —
          {" "}+{flow.omittedInvestors} more investors, +{flow.omittedCompanies} more companies not shown.
        </div>
      )}
      <div className="cap">
        {measure === "count"
          ? "link width = real disclosed deal count between that investor and company, not a dollar amount — a syndicated round's full amount can't be honestly split per co-investor"
          : "link width = real disclosed dollars from unsyndicated (single-investor) rounds only — syndicated rounds contribute to deal-count mode but not here"}
        {" "}(see "Who's writing the checks"). Particle motion shows direction only, at a fixed speed — it is not a measure of momentum or amount.
      </div>
    </div>
  );
}
