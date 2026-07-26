import { useMemo, useState } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyNode } from "d3-sankey";
import type { Entry } from "../lib/types.ts";
import {
  buildResearchFlow, entriesForResearchFlowLink, RESEARCH_FLOW_TOP_COUNTRIES, RESEARCH_FLOW_TOP_INSTITUTIONS,
  type ResearchFlowNode,
} from "../lib/researchFlow.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { usePrefersReducedMotion } from "../lib/useReducedMotion.ts";
import { scatterDots } from "../lib/sankeyParticles.ts";
import { Tooltip } from "./Tooltip.tsx";

const WIDTH = 1360;
const HEIGHT = 680;
const LEFT_MARGIN = 190; // country labels sit here — real ribbon-free margin, same convention as MoneyFlowSankey's investor side
const RIGHT_MARGIN = 150; // "Publications" / "Patents" labels — short, don't need as much room
const TOP_MARGIN = 46;

// Country -> Institution -> Output-type flow (see researchFlow.ts for the
// real data this is built from). Three columns instead of MoneyFlowSankey's
// two, which changes one thing about labeling: country and output nodes
// sit in genuinely ribbon-free outer margins and get an always-on side
// label exactly like MoneyFlowSankey's investor/company nodes, but the
// middle institution column sits between two ribbon-dense internal gaps —
// there's no ribbon-free space to print up to 18 institution names without
// them overlapping the flow lines. Institution identity surfaces through
// hover/click instead (tooltip + the existing org drawer), same as any
// other real-but-secondary label in this app; the "Top institutions" panel
// right above this chart in TrackResearch.tsx already is the place a reader
// goes to read institution names directly.
export function ResearchFlowSankey({
  entries,
  onSelectCountry,
  onSelectOrg,
  onSelectLink,
}: {
  entries: Entry[];
  onSelectCountry?: (country: string) => void;
  onSelectOrg?: (orgId: string) => void;
  onSelectLink?: (sourceId: string, targetId: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [particlesOn, setParticlesOn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  const [pinnedNode, setPinnedNode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  const flow = useMemo(
    () => buildResearchFlow(entries, {
      topCountries: expanded ? RESEARCH_FLOW_TOP_COUNTRIES * 2 : RESEARCH_FLOW_TOP_COUNTRIES,
      topInstitutions: expanded ? RESEARCH_FLOW_TOP_INSTITUTIONS * 2 : RESEARCH_FLOW_TOP_INSTITUTIONS,
    }),
    [entries, expanded]
  );

  const graph = useMemo(() => {
    if (flow.nodes.length === 0 || flow.links.length === 0) return null;
    const layout = sankey<ResearchFlowNode, { value: number }>()
      .nodeId((d) => d.id)
      .nodeWidth(14)
      .nodePadding(8)
      .extent([[LEFT_MARGIN, TOP_MARGIN], [WIDTH - RIGHT_MARGIN, HEIGHT - 20]]);
    return layout({
      nodes: flow.nodes.map((n) => ({ ...n })),
      links: flow.links.map((l) => ({ source: l.source, target: l.target, value: l.value })),
    });
  }, [flow]);

  if (!graph) {
    return <div className="trend-empty">Not enough institution-attributed research yet to draw a flow diagram.</div>;
  }

  const linkPath = sankeyLinkHorizontal();
  const maxValue = Math.max(1, ...graph.links.map((l) => l.value));
  const focusNode = hoverNode ?? pinnedNode;
  const searchQuery = search.trim().toLowerCase();
  const matchesSearch = (label: string) => searchQuery.length > 0 && label.toLowerCase().includes(searchQuery);
  const anySearch = searchQuery.length > 0;

  // Every institution here has exactly one real home country (researchFlow.ts
  // only ever links a country to institutions actually headquartered
  // there) — read back off the country->institution links themselves so
  // rendering never needs a second lookup structure to stay in sync with it.
  const institutionCountryOf = new Map<string, string>();
  for (const l of graph.links) {
    const s = l.source as SankeyNode<ResearchFlowNode, { value: number }>;
    const t = l.target as SankeyNode<ResearchFlowNode, { value: number }>;
    if (s.kind === "country") institutionCountryOf.set(t.id, s.id);
  }
  const colorFor = (id: string) => countryColor(institutionCountryOf.get(id) ?? id);

  function isLinkActive(i: number, sourceId: string, targetId: string, sourceLabel: string, targetLabel: string): boolean {
    if (anySearch) return matchesSearch(sourceLabel) || matchesSearch(targetLabel);
    if (hoverLink != null) return hoverLink === i;
    if (!focusNode) return false;
    if (sourceId === focusNode || targetId === focusNode) return true;
    // A country focus traces all the way through to its institutions' own
    // output links, not just its own direct edges — "continue the story"
    // from country of origin through to publications/patents.
    return institutionCountryOf.get(sourceId) === focusNode;
  }
  const anyHover = focusNode != null || hoverLink != null || anySearch;

  return (
    <div>
      <div className="tab-bar">
        <button className="chip" aria-pressed={particlesOn} onClick={() => setParticlesOn((p) => !p)}>Particles {particlesOn ? "on" : "off"}</button>
        {(flow.omittedCountries > 0 || flow.omittedInstitutions > 0 || expanded) && (
          <button className="chip" aria-pressed={expanded} onClick={() => setExpanded((e) => !e)}>{expanded ? "Show fewer" : "Show more"}</button>
        )}
        <input
          className="country-filter-select"
          type="search"
          placeholder="Search country or institution…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search research flow nodes"
          style={{ maxWidth: 200 }}
        />
        <button className="chip" onClick={() => { setHoverNode(null); setHoverLink(null); setPinnedNode(null); setSearch(""); }}>Reset</button>
      </div>

      <div className="sankey-legend">
        <span>Color = real institution/awardee country, same scheme as the map and country badges</span>
        <span>Link width = real tracked record count</span>
        <span>Hover or click a country to trace its institutions through to publications/patents</span>
        <span>Institution names aren't printed on the chart itself — hover a middle bar, or use the Top Institutions panel above</span>
        <span>Top {expanded ? RESEARCH_FLOW_TOP_COUNTRIES * 2 : RESEARCH_FLOW_TOP_COUNTRIES} countries × top {expanded ? RESEARCH_FLOW_TOP_INSTITUTIONS * 2 : RESEARCH_FLOW_TOP_INSTITUTIONS} institutions by tracked volume</span>
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
          aria-label="Country to institution to publication/patent output flow"
          onClick={() => setPinnedNode(null)}
        >
          <text x={LEFT_MARGIN} y={24} fontSize={11} fontWeight={700} letterSpacing="0.06em" fill="var(--mist)">COUNTRY</text>
          <text x={WIDTH - RIGHT_MARGIN} y={24} fontSize={11} fontWeight={700} letterSpacing="0.06em" fill="var(--mist)" textAnchor="end">OUTPUT TYPE</text>

          {graph.links.map((l, i) => {
            const source = l.source as SankeyNode<ResearchFlowNode, { value: number }>;
            const target = l.target as SankeyNode<ResearchFlowNode, { value: number }>;
            const d = linkPath(l as never);
            if (!d) return null;
            const active = isLinkActive(i, source.id, target.id, source.label, target.label);
            const width = Math.max(1, l.width ?? 1);
            const color = colorFor(source.id);
            const dots = particlesOn && !reducedMotion
              ? scatterDots(source.x1 ?? 0, l.y0 ?? 0, target.x0 ?? 0, l.y1 ?? 0, width, 6 + Math.sqrt(l.value / maxValue) * 28, i)
              : [];
            return (
              <g key={i}>
                <path
                  id={`research-flow-link-${i}`}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeOpacity={anyHover ? (active ? 0.9 : 0.05) : 0.42}
                  strokeWidth={active ? width + 1.5 : width}
                  style={{ cursor: onSelectLink ? "pointer" : "default", transition: "stroke-opacity 0.15s, stroke-width 0.15s" }}
                  role={onSelectLink ? "button" : undefined}
                  tabIndex={onSelectLink ? 0 : undefined}
                  aria-label={onSelectLink ? `${source.label} to ${target.label}, ${l.value} tracked records` : undefined}
                  onMouseEnter={() => setHoverLink(i)}
                  onMouseLeave={() => { setHoverLink(null); setTip(null); }}
                  onMouseMove={(e) =>
                    setTip({
                      x: e.clientX,
                      y: e.clientY,
                      content: (
                        <>
                          <div style={{ fontWeight: 600 }}>{source.label} → {target.label}</div>
                          <div>{l.value} tracked record{l.value === 1 ? "" : "s"}</div>
                          <div style={{ color: "var(--mist)", fontSize: 10 }}>click for the underlying records</div>
                        </>
                      ),
                    })
                  }
                  onClick={(e) => { e.stopPropagation(); onSelectLink?.(source.id, target.id); }}
                  onKeyDown={(e) => { if (onSelectLink && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelectLink(source.id, target.id); } }}
                />
                {dots.map((dot, pi) => {
                  const base = anyHover ? (active ? 0.95 : 0.05) : 0.5;
                  return (
                    <circle key={pi} cx={dot.x} cy={dot.y} r={dot.r} fill={color} opacity={base}>
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
            const isFocused = focusNode === n.id;
            const isPinned = pinnedNode === n.id;
            const isSearchMatch = matchesSearch(n.label);
            const faded = anySearch ? !isSearchMatch : anyHover && !isFocused && hoverLink == null;
            const onSelect = n.kind === "country" ? onSelectCountry : n.kind === "institution" ? onSelectOrg : undefined;
            // openOrgDrawer() re-canonicalizes whatever string it's given
            // (see App.tsx) — it wants the raw org display name, same
            // contract Leaderboard.tsx's onSelect already follows, not the
            // already-canonicalized id this node uses for its own identity/
            // link-matching.
            const selectValue = n.kind === "institution" ? n.label : n.id;
            const fill = n.kind === "output" ? "var(--ink)" : colorFor(n.id);
            const homeCountry = n.kind === "institution" ? institutionCountryOf.get(n.id) : null;
            const detailLine = n.kind === "country"
              ? `${n.count} tracked record${n.count === 1 ? "" : "s"}`
              : n.kind === "institution"
                ? `${n.count} tracked record${n.count === 1 ? "" : "s"} · ${countryName(homeCountry)}`
                : `${n.count} tracked record${n.count === 1 ? "" : "s"}`;
            // Only the outer two columns get an always-visible printed
            // label (they sit in real ribbon-free margins) — see the
            // component comment above for why institution nodes don't.
            const showLabel = n.kind !== "institution";
            const nameLine = n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label;
            const labelOnLeft = n.kind === "country";
            return (
              <g
                key={i}
                opacity={faded ? 0.35 : 1}
                style={{ cursor: onSelect ? "pointer" : "default", outline: isPinned ? "2px solid var(--red)" : "none", outlineOffset: 2 }}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={`${n.label}, ${detailLine}${isPinned ? " (isolated)" : ""}`}
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
                        <div style={{ color: "var(--mist)", fontSize: 10 }}>
                          {n.kind === "country" ? "Country" : n.kind === "institution" ? "Institution" : "Output type"}
                          {onSelect ? " · click to isolate + open details" : " · click to isolate"}
                        </div>
                      </>
                    ),
                  })
                }
                onClick={(e) => { e.stopPropagation(); setPinnedNode((p) => (p === n.id ? null : n.id)); onSelect?.(selectValue); }}
                onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setPinnedNode((p) => (p === n.id ? null : n.id)); onSelect(selectValue); } }}
              >
                <rect x={x0} y={y0} width={Math.max(1, x1 - x0)} height={Math.max(1, y1 - y0)} fill={fill} />
                {showLabel && (
                  <>
                    <text x={labelOnLeft ? x0 - 8 : x1 + 8} y={(y0 + y1) / 2 - 5} textAnchor={labelOnLeft ? "end" : "start"} fontSize={10.5} fontWeight={isFocused ? 700 : 600} fill="var(--ink)">
                      {nameLine}
                    </text>
                    <text x={labelOnLeft ? x0 - 8 : x1 + 8} y={(y0 + y1) / 2 + 8} textAnchor={labelOnLeft ? "end" : "start"} fontSize={9} fill="var(--mist)">
                      {detailLine}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {tip && <Tooltip x={tip.x} y={tip.y}>{tip.content}</Tooltip>}
      {(flow.omittedCountries > 0 || flow.omittedInstitutions > 0) && (
        <div className="trend-note" style={{ marginTop: 4, fontSize: 11 }}>
          +{flow.omittedCountries} more countries, +{flow.omittedInstitutions} more institutions with real, smaller tracked output — not shown here.
        </div>
      )}
      <div className="cap">
        link width = real tracked record count between a country's institutions and their publication/patent output ·
        an institution is placed under the one real country it's headquartered in · particle motion is a density
        texture only, not a measure of momentum · click a node to isolate its full path, click empty space or Reset to clear
      </div>
    </div>
  );
}

export { entriesForResearchFlowLink };
