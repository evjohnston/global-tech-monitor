import { useMemo, useState } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyNode } from "d3-sankey";
import type { VcCompanyFunding } from "../lib/types.ts";
import { buildMoneyFlow, MONEY_FLOW_TOP_COMPANIES, MONEY_FLOW_TOP_INVESTORS, type MoneyFlowNode } from "../lib/moneyFlow.ts";
import { fmtUsd } from "../lib/format.ts";
import { usePrefersReducedMotion } from "../lib/useReducedMotion.ts";
import { scatterDots } from "../lib/sankeyParticles.ts";
import { Tooltip } from "./Tooltip.tsx";

// WIDTH matches the v5 content container (--maxw: 1440px minus desktop
// padding) so this renders at full content width instead of leaving a
// fixed-1180px chart stranded with unused margin beside it on wide
// viewports. HEIGHT meets the spec's 680px desktop minimum.
const WIDTH = 1360;
const HEIGHT = 680;
const LABEL_MARGIN = 240;
const TOP_MARGIN = 46; // room for the INVESTORS / RECIPIENT COMPANIES headings

// Real investor -> company DEAL-COUNT flow only (see moneyFlow.ts) — amount
// mode was removed from the Sankey entirely (section 7B): when one company
// dominates disclosed funding, a Sankey's proportional link width collapses
// into one unreadable rectangle. Attributable disclosed amount is now its
// own ranked-bars/matrix view (MoneyFlowRankedBars.tsx /
// MoneyFlowMatrix.tsx), not this chart.
//
// Full label margins on both sides so every visible node has a real,
// always-on label (name + real activity counts) — no reader should have to
// hover blindly to identify a node. d3-sankey supplies only the node/link
// layout math (same division of labor as WorldMap.tsx using d3-geo purely
// for map projection); rendering stays hand-rolled SVG.
export function MoneyFlowSankey({
  companies,
  onSelectInvestor,
  onSelectCompany,
  onSelectLink,
}: {
  companies: VcCompanyFunding[];
  onSelectInvestor?: (name: string) => void;
  onSelectCompany?: (name: string) => void;
  onSelectLink?: (investor: string, companyId: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [particlesOn, setParticlesOn] = useState(false); // off by default, per spec
  const [expanded, setExpanded] = useState(false);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  // Clicking a node ISOLATES it (persists after the mouse leaves, unlike
  // hover) — hover still previews on top of a pin, but clicking empty
  // space or Reset clears the pin. Distinct from the drawer the click also
  // opens: isolating and opening details are two different real actions
  // that happen to share one click.
  const [pinnedNode, setPinnedNode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  const flow = useMemo(
    () => buildMoneyFlow(companies, { measure: "count", topInvestors: expanded ? MONEY_FLOW_TOP_INVESTORS * 2 : MONEY_FLOW_TOP_INVESTORS, topCompanies: expanded ? MONEY_FLOW_TOP_COMPANIES * 2 : MONEY_FLOW_TOP_COMPANIES }),
    [companies, expanded]
  );

  const graph = useMemo(() => {
    if (flow.nodes.length === 0 || flow.links.length === 0) return null;
    const layout = sankey<MoneyFlowNode, { value: number; dealCount: number }>()
      .nodeId((d) => d.id)
      .nodeWidth(14)
      .nodePadding(12)
      .extent([[LABEL_MARGIN, TOP_MARGIN], [WIDTH - LABEL_MARGIN, HEIGHT - 20]]);
    return layout({
      nodes: flow.nodes.map((n) => ({ ...n })),
      links: flow.links.map((l) => ({ source: l.source, target: l.target, value: l.value, dealCount: l.dealCount })),
    });
  }, [flow]);

  if (!graph) {
    return <div className="trend-empty">Not enough overlapping deal activity yet to draw a flow diagram.</div>;
  }

  const linkPath = sankeyLinkHorizontal();
  const maxValue = Math.max(1, ...graph.links.map((l) => l.value));
  const focusNode = hoverNode ?? pinnedNode; // hover previews on top of a pin, pin persists after the mouse leaves
  const searchQuery = search.trim().toLowerCase();
  const matchesSearch = (label: string) => searchQuery.length > 0 && label.toLowerCase().includes(searchQuery);
  const anySearch = searchQuery.length > 0;

  function isLinkActive(i: number, source: string, target: string, sourceLabel: string, targetLabel: string): boolean {
    if (anySearch) return matchesSearch(sourceLabel) || matchesSearch(targetLabel);
    if (hoverLink != null) return hoverLink === i;
    if (focusNode) return source === focusNode || target === focusNode;
    return false;
  }
  const anyHover = focusNode != null || hoverLink != null || anySearch;

  return (
    <div>
      <div className="tab-bar">
        <button className="chip" aria-pressed={particlesOn} onClick={() => setParticlesOn((p) => !p)}>Particles {particlesOn ? "on" : "off"}</button>
        {(flow.omittedInvestors > 0 || flow.omittedCompanies > 0 || expanded) && (
          <button className="chip" aria-pressed={expanded} onClick={() => setExpanded((e) => !e)}>{expanded ? "Show fewer" : "Show more"}</button>
        )}
        <input
          className="country-filter-select"
          type="search"
          placeholder="Search investor or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search Sankey nodes"
          style={{ maxWidth: 200 }}
        />
        <button className="chip" onClick={() => { setHoverNode(null); setHoverLink(null); setPinnedNode(null); setSearch(""); }}>Reset</button>
      </div>

      <div className="sankey-legend">
        <span><span className="sankey-legend-swatch" style={{ background: "var(--red)" }} /> Investor</span>
        <span><span className="sankey-legend-swatch" style={{ background: "var(--ink)" }} /> Recipient company</span>
        <span>Link width = real tracked deal count</span>
        <span>Particles show direction only (varied timing, not a measure of amount), off by default</span>
        <span>Top {expanded ? MONEY_FLOW_TOP_INVESTORS * 2 : MONEY_FLOW_TOP_INVESTORS} investors × top {expanded ? MONEY_FLOW_TOP_COMPANIES * 2 : MONEY_FLOW_TOP_COMPANIES} companies by activity — see below for what's excluded</span>
      </div>
      {expanded && (
        <div className="trend-note" style={{ marginBottom: 6 }}>Showing more nodes than the default — labels and links get denser and harder to trace at this size.</div>
      )}

      <div className="sankey-scroll">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width={WIDTH}
          style={{ minWidth: WIDTH, maxWidth: "100%" }}
          height={HEIGHT}
          role="img"
          aria-label="Investor to company deal flow"
          onClick={() => setPinnedNode(null)}
        >
          <text x={LABEL_MARGIN} y={24} fontSize={11} fontWeight={700} letterSpacing="0.06em" fill="var(--mist)">INVESTORS</text>
          <text x={WIDTH - LABEL_MARGIN} y={24} fontSize={11} fontWeight={700} letterSpacing="0.06em" fill="var(--mist)" textAnchor="end">RECIPIENT COMPANIES</text>

          {graph.links.map((l, i) => {
            const source = l.source as SankeyNode<MoneyFlowNode, { value: number; dealCount: number }>;
            const target = l.target as SankeyNode<MoneyFlowNode, { value: number; dealCount: number }>;
            const d = linkPath(l as never);
            if (!d) return null;
            const active = isLinkActive(i, source.id, target.id, source.label, target.label);
            const width = Math.max(1, l.width ?? 1);
            // A dense scatter of dots filling the ribbon's real area (not a
            // few crawling its centerline) — count scales with the link's
            // real value relative to the diagram's max, so a bigger real
            // flow reads as a visibly denser fill, never an arbitrary fixed
            // count. Every link gets a real, visible texture when
            // particles are on; the active/hovered link's dots stay full
            // brightness while the rest dim along with their ribbon.
            const dots = particlesOn && !reducedMotion
              ? scatterDots(source.x1 ?? 0, l.y0 ?? 0, target.x0 ?? 0, l.y1 ?? 0, width, 6 + Math.sqrt(l.value / maxValue) * 28, i)
              : [];
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
                          <div style={{ color: "var(--mist)", fontSize: 10 }}>S&P Capital IQ · click for the underlying transactions</div>
                        </>
                      ),
                    })
                  }
                  onClick={(e) => { e.stopPropagation(); onSelectLink?.(source.id, target.id); }}
                  onKeyDown={(e) => { if (onSelectLink && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelectLink(source.id, target.id); } }}
                />
                {dots.map((dot, pi) => {
                  // A stationary scatter, not a trickle crawling the
                  // centerline — each dot sits at its own fixed spot
                  // somewhere across the ribbon's real thickness (from
                  // scatterDots()) and only twinkles in place, so at any
                  // instant the whole ribbon reads as densely filled the
                  // way the reference does, not as a few moving points.
                  const base = anyHover ? (active ? 0.95 : 0.05) : 0.55;
                  return (
                    <circle key={pi} cx={dot.x} cy={dot.y} r={dot.r} fill={active ? "var(--red)" : "var(--slate)"} opacity={base}>
                      <animate
                        attributeName="opacity"
                        values={`${(base * 0.35).toFixed(2)};${base.toFixed(2)};${(base * 0.35).toFixed(2)}`}
                        dur={`${dot.dur.toFixed(2)}s`}
                        begin={`${dot.delay.toFixed(2)}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  );
                })}
              </g>
            );
          })}
          {graph.nodes.map((n, i) => {
            const x0 = n.x0 ?? 0, x1 = n.x1 ?? 0, y0 = n.y0 ?? 0, y1 = n.y1 ?? 0;
            const isInvestor = n.kind === "investor";
            const isFocused = focusNode === n.id;
            const isPinned = pinnedNode === n.id;
            const isSearchMatch = matchesSearch(n.label);
            const faded = anySearch ? !isSearchMatch : anyHover && !isFocused && hoverLink == null;
            const onSelect = isInvestor ? onSelectInvestor : onSelectCompany;
            const nameLine = n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label;
            const detailLine = isInvestor
              ? `${n.dealCount} tracked deal${n.dealCount === 1 ? "" : "s"} · ${n.companyCount ?? 0} compan${(n.companyCount ?? 0) === 1 ? "y" : "ies"}`
              : n.totalRaisedUsd
                ? `${n.dealCount} tracked round${n.dealCount === 1 ? "" : "s"} · ${fmtUsd(n.totalRaisedUsd)} disclosed`
                : `${n.dealCount} tracked round${n.dealCount === 1 ? "" : "s"}`;
            return (
              <g
                key={i}
                opacity={faded ? 0.35 : 1}
                style={{ cursor: onSelect ? "pointer" : "default", outline: isPinned ? "2px solid var(--red)" : "none", outlineOffset: 2 }}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={onSelect ? `${n.label}, ${detailLine}${isPinned ? " (isolated)" : ""}` : undefined}
                onMouseEnter={() => setHoverNode(n.id)}
                onMouseLeave={() => { setHoverNode(null); setTip(null); }}
                onMouseMove={(e) =>
                  setTip({
                    x: e.clientX,
                    y: e.clientY,
                    content: (
                      <>
                        <div style={{ fontWeight: 600 }}>{n.label}</div>
                        <div>{detailLine}</div>
                        <div style={{ color: "var(--mist)", fontSize: 10 }}>{isInvestor ? "Investor" : "Company"} · S&P Capital IQ · click to isolate + open details</div>
                      </>
                    ),
                  })
                }
                onClick={(e) => { e.stopPropagation(); setPinnedNode((p) => (p === n.id ? null : n.id)); onSelect?.(n.id); }}
                onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setPinnedNode((p) => (p === n.id ? null : n.id)); onSelect(n.id); } }}
              >
                <rect x={x0} y={y0} width={Math.max(1, x1 - x0)} height={Math.max(1, y1 - y0)} fill={isInvestor ? "var(--red)" : "var(--ink)"} />
                <text x={isInvestor ? x0 - 8 : x1 + 8} y={(y0 + y1) / 2 - 5} textAnchor={isInvestor ? "end" : "start"} fontSize={10.5} fontWeight={isFocused ? 700 : 600} fill="var(--ink)">
                  {nameLine}
                </text>
                <text x={isInvestor ? x0 - 8 : x1 + 8} y={(y0 + y1) / 2 + 8} textAnchor={isInvestor ? "end" : "start"} fontSize={9} fill="var(--mist)">
                  {detailLine}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {tip && <Tooltip x={tip.x} y={tip.y}>{tip.content}</Tooltip>}
      {(flow.omittedInvestors > 0 || flow.omittedCompanies > 0) && (
        <div className="trend-note" style={{ marginTop: 4, fontSize: 11 }}>
          +{flow.omittedInvestors} more investors, +{flow.omittedCompanies} more companies with real, smaller tracked activity — not shown here.
        </div>
      )}
      <div className="cap">
        link width = real disclosed deal count between that investor and company · a company's disclosed total (shown
        as text, never as link width) is its own real all-time raise, not attributed to any one investor · particle
        motion shows direction only — per-particle speed/timing varies so they don't move in lockstep, but this is
        purely visual, not a measure of momentum or amount · click a node to isolate it, click empty space or Reset to clear
      </div>
    </div>
  );
}
