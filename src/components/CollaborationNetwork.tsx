import { useMemo, useState } from "react";
import type { Entry } from "../lib/types.ts";
import { collaborationEdges, collaborationTotalsByCountry, topPartnersFor } from "../lib/collaboration.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";
import { BarRow } from "./BarRow.tsx";

const TOP_N_COUNTRIES = 14;
const MATRIX_N = 8;

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

type Mode = "ranking" | "matrix" | "network";

// Real cross-border co-authorship, from Entry.collaboratingCountries (see
// openalex.ts) — every edge here is one real paper whose authors' resolved
// institutions span 2+ countries, never inferred or fabricated.
//
// Default view is a readable ranked partner list, NOT the radial network —
// a hairball of every edge at once needs interaction to mean anything,
// which fails "understand the chart before hovering." The Network tab
// stays available but always has a real focus country driving it (defaults
// to the most-connected one), never rendering every edge undifferentiated.
export function CollaborationNetwork({
  entries,
  emphasize,
  onSelectCountry,
  onSelectPair,
}: {
  entries: Entry[];
  emphasize?: string[];
  onSelectCountry?: (country: string) => void;
  onSelectPair?: (a: string, b: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("ranking");
  const edges = useMemo(() => collaborationEdges(entries), [entries]);
  const totals = useMemo(() => collaborationTotalsByCountry(edges), [edges]);
  const rankedCountries = useMemo(() => Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([c]) => c), [totals]);
  const [focusCountry, setFocusCountry] = useState<string | null>(null);
  const activeFocus = focusCountry ?? emphasize?.[0] ?? rankedCountries[0] ?? null;

  if (edges.length === 0) {
    return <div className="trend-empty">No real cross-border co-authorships resolved yet for this vertical.</div>;
  }

  return (
    <div>
      <div className="tab-bar">
        <button className="chip" aria-pressed={mode === "ranking"} onClick={() => setMode("ranking")}>Partner ranking</button>
        <button className="chip" aria-pressed={mode === "matrix"} onClick={() => setMode("matrix")}>Matrix</button>
        <button className="chip" aria-pressed={mode === "network"} onClick={() => setMode("network")}>Network</button>
      </div>
      {(mode === "ranking" || mode === "network") && (
        <div className="tab-bar" style={{ marginBottom: 10 }}>
          <span className="lbl" style={{ marginRight: 2 }}>Focus country</span>
          {rankedCountries.slice(0, 10).map((c) => (
            <button key={c} className="chip" aria-pressed={activeFocus === c} onClick={() => setFocusCountry(c)}>{countryName(c)}</button>
          ))}
        </div>
      )}
      {mode === "ranking" && activeFocus && (
        <RankingView edges={edges} country={activeFocus} onSelectPair={onSelectPair} onSelectCountry={onSelectCountry} />
      )}
      {mode === "matrix" && <MatrixView edges={edges} rankedCountries={rankedCountries} onSelectPair={onSelectPair} />}
      {mode === "network" && activeFocus && (
        <NetworkView edges={edges} rankedCountries={rankedCountries} focusCountry={activeFocus} emphasize={emphasize} onSelectCountry={onSelectCountry} onSelectPair={onSelectPair} />
      )}
      <div className="cap">
        an edge is one real paper whose authors' institutions span 2+ countries with resolvable data — domestic-only
        papers and works with no resolvable institution data (a disclosed gap for country attribution generally)
        contribute nothing here. This shows who has co-published, not a claim about who depends on whom.
      </div>
    </div>
  );
}

// Default view: "United States collaboration partners — United Kingdom 28,
// Germany 24, ..." — readable immediately, no interaction required.
function RankingView({
  edges, country, onSelectPair, onSelectCountry,
}: {
  edges: ReturnType<typeof collaborationEdges>;
  country: string;
  onSelectPair?: (a: string, b: string) => void;
  onSelectCountry?: (c: string) => void;
}) {
  const partners = topPartnersFor(edges, country, 10);
  const max = Math.max(1, ...partners.map((p) => p.count));
  if (partners.length === 0) return <div className="trend-empty">No real cross-border co-authorships resolved yet for {countryName(country)}.</div>;
  return (
    <div>
      <h4 className="collab-ranking-title">
        {countryName(country)} collaboration partners
        {onSelectCountry && <button className="drawer-link-btn" style={{ marginLeft: 8, fontWeight: 400 }} onClick={() => onSelectCountry(country)}>open profile →</button>}
      </h4>
      {partners.map((p) => (
        <BarRow
          key={p.partner}
          label={countryName(p.partner)}
          pct={(p.count / max) * 100}
          color={countryColor(p.partner)}
          valueLabel={`${p.count} paper${p.count === 1 ? "" : "s"}`}
          detail={`${countryName(country)} – ${countryName(p.partner)} · ${p.count} real co-authored papers · click for the papers`}
          onClick={onSelectPair ? () => onSelectPair(country, p.partner) : undefined}
        />
      ))}
    </div>
  );
}

function MatrixView({
  edges, rankedCountries, onSelectPair,
}: {
  edges: ReturnType<typeof collaborationEdges>;
  rankedCountries: string[];
  onSelectPair?: (a: string, b: string) => void;
}) {
  const countries = rankedCountries.slice(0, MATRIX_N);
  const lookup = new Map<string, number>();
  for (const e of edges) lookup.set(edgeKey(e.a, e.b), e.count);
  const max = Math.max(1, ...edges.map((e) => e.count));
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="lb collab-matrix">
        <thead>
          <tr>
            <th></th>
            {countries.map((c) => <th key={c} className="right">{countryName(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {countries.map((row) => (
            <tr key={row}>
              <td className="org-name">{countryName(row)}</td>
              {countries.map((col) => {
                if (row === col) return <td key={col} className="right count matrix-diag">—</td>;
                const count = lookup.get(edgeKey(row, col)) ?? 0;
                const intensity = count / max;
                return (
                  <td
                    key={col}
                    className={`right count${count > 0 && onSelectPair ? " clickable" : ""}`}
                    style={count > 0 ? { background: `rgba(152,0,46,${0.08 + intensity * 0.4})` } : undefined}
                    onClick={count > 0 ? () => onSelectPair?.(row, col) : undefined}
                    title={count > 0 ? `${countryName(row)} – ${countryName(col)} · ${count} papers` : "No tracked collaboration"}
                  >
                    {count > 0 ? count : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NetworkView({
  edges, rankedCountries, focusCountry, emphasize, onSelectCountry, onSelectPair,
}: {
  edges: ReturnType<typeof collaborationEdges>;
  rankedCountries: string[];
  focusCountry: string;
  emphasize?: string[];
  onSelectCountry?: (country: string) => void;
  onSelectPair?: (a: string, b: string) => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [hoverCountry, setHoverCountry] = useState<string | null>(null);

  const shown = rankedCountries.slice(0, TOP_N_COUNTRIES);
  const shownSet = new Set(shown);
  const shownEdges = edges.filter((e) => shownSet.has(e.a) && shownSet.has(e.b));
  const maxCount = Math.max(1, ...shownEdges.map((e) => e.count));
  const hoveredOrFocus = hoverCountry ?? focusCountry;
  const partners = topPartnersFor(edges, hoveredOrFocus, 5);

  const size = 360;
  const cx = size / 2, cy = size / 2, r = size / 2 - 44;
  const pos = new Map<string, { x: number; y: number }>();
  shown.forEach((c, i) => {
    const angle = (i / shown.length) * Math.PI * 2 - Math.PI / 2;
    pos.set(c, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  });
  const omittedCountries = rankedCountries.length - shown.length;

  function isEdgeActive(a: string, b: string): boolean {
    if (hoverEdge) return hoverEdge === edgeKey(a, b);
    return a === hoveredOrFocus || b === hoveredOrFocus;
  }

  return (
    <div className="collab-layout">
      <div className="collab-diagram">
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} role="img" aria-label={`${countryName(focusCountry)} collaboration network`}>
          {shownEdges.map((e, i) => {
            const pa = pos.get(e.a), pb = pos.get(e.b);
            if (!pa || !pb) return null;
            const compareFaded = !!emphasize?.length && !(emphasize.includes(e.a) && emphasize.includes(e.b));
            const active = isEdgeActive(e.a, e.b);
            const width = 0.75 + Math.sqrt(e.count / maxCount) * 4;
            return (
              <path
                key={i}
                d={`M ${pa.x} ${pa.y} Q ${cx} ${cy} ${pb.x} ${pb.y}`}
                fill="none"
                stroke="var(--slate)"
                strokeWidth={active ? width + 1 : width}
                opacity={!active ? 0.06 : compareFaded ? 0.15 : 0.55}
                style={{ cursor: onSelectPair ? "pointer" : "default" }}
                role={onSelectPair ? "button" : undefined}
                tabIndex={onSelectPair ? 0 : undefined}
                aria-label={onSelectPair ? `${countryName(e.a)} and ${countryName(e.b)}, ${e.count} papers` : undefined}
                onClick={() => onSelectPair?.(e.a, e.b)}
                onKeyDown={(ev) => { if (onSelectPair && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); onSelectPair(e.a, e.b); } }}
                onMouseEnter={() => setHoverEdge(edgeKey(e.a, e.b))}
                onMouseMove={(ev) =>
                  setTip({ x: ev.clientX, y: ev.clientY, label: `${countryName(e.a)} – ${countryName(e.b)} · ${e.count} real co-authored paper${e.count === 1 ? "" : "s"}${onSelectPair ? " · click for the papers" : ""}` })
                }
                onMouseLeave={() => { setHoverEdge(null); setTip(null); }}
              />
            );
          })}
          {shown.map((c) => {
            const p = pos.get(c)!;
            const isFocusOrHover = c === hoveredOrFocus;
            return (
              <g
                key={c}
                opacity={!isFocusOrHover && (hoverCountry || focusCountry) ? 0.35 : 1}
                style={{ cursor: onSelectCountry ? "pointer" : "default", outline: "none" }}
                role={onSelectCountry ? "button" : undefined}
                tabIndex={onSelectCountry ? 0 : undefined}
                aria-label={onSelectCountry ? `${countryName(c)} profile` : undefined}
                onClick={() => onSelectCountry?.(c)}
                onKeyDown={(ev) => { if (onSelectCountry && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); onSelectCountry(c); } }}
                onMouseEnter={() => setHoverCountry(c)}
                onMouseLeave={() => setHoverCountry(null)}
              >
                <circle cx={p.x} cy={p.y} r={isFocusOrHover ? 6.5 : 5} fill={countryColor(c)} />
                <text x={p.x + (p.x > cx ? 8 : -8)} y={p.y + (p.y > cy ? 12 : -8)} textAnchor={p.x > cx ? "start" : "end"} fontSize={10} fontWeight={isFocusOrHover ? 700 : 400} fill="var(--ink-2)">
                  {countryName(c)}
                </text>
              </g>
            );
          })}
        </svg>
        {tip && <Tooltip x={tip.x} y={tip.y}>{tip.label}</Tooltip>}
        {omittedCountries > 0 && (
          <div className="trend-note" style={{ marginTop: 4, fontSize: 11 }}>Showing the {shown.length} most internationally-connected countries — +{omittedCountries} more with real, smaller collaboration counts.</div>
        )}
      </div>
      {partners.length > 0 && (
        <div className="collab-partners">
          <div className="drawer-label">{countryName(hoveredOrFocus)}'s top partners</div>
          <ul className="drawer-list">{partners.map((p) => <li key={p.partner}>{countryName(p.partner)} · {p.count}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
