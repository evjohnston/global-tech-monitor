import { useState } from "react";
import type { Entry } from "../lib/types.ts";
import { collaborationEdges, collaborationTotalsByCountry } from "../lib/collaboration.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

const TOP_N_COUNTRIES = 14;
const TOP_N_PAIRS = 20;

// Real cross-border co-authorship, from Entry.collaboratingCountries (see
// openalex.ts) — every edge here is one real paper whose authors' resolved
// institutions span 2+ countries, never inferred or fabricated. This is a
// different case from StageComposition.tsx's documented refusal to draw a
// Sankey between pipeline stages (that would claim a real-world link the
// data doesn't support) — here the link genuinely exists, it's an actual
// shared paper, so drawing it is honest.
//
// Edges render in one neutral tone rather than either endpoint's country
// color — an edge belongs to both countries equally, and picking one's
// color would misleadingly imply direction or ownership. Country color is
// reserved for the node dots/labels, same discipline as the rest of this
// app's color budget.
export function CollaborationNetwork({
  entries,
  emphasize,
  onSelectCountry,
}: {
  entries: Entry[];
  emphasize?: string[];
  onSelectCountry?: (country: string) => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const edges = collaborationEdges(entries);

  if (edges.length === 0) {
    return <div className="trend-empty">No real cross-border co-authorships resolved yet for this vertical.</div>;
  }

  const totals = collaborationTotalsByCountry(edges);
  const rankedCountries = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const shown = rankedCountries.slice(0, TOP_N_COUNTRIES);
  const shownSet = new Set(shown);
  const shownEdges = edges.filter((e) => shownSet.has(e.a) && shownSet.has(e.b));
  const maxCount = Math.max(1, ...shownEdges.map((e) => e.count));

  const size = 360;
  const cx = size / 2, cy = size / 2, r = size / 2 - 44;
  const pos = new Map<string, { x: number; y: number }>();
  shown.forEach((c, i) => {
    const angle = (i / shown.length) * Math.PI * 2 - Math.PI / 2;
    pos.set(c, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  });

  const omittedCountries = rankedCountries.length - shown.length;

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} role="img" aria-label="Cross-border research collaboration network">
        {shownEdges.map((e, i) => {
          const pa = pos.get(e.a), pb = pos.get(e.b);
          if (!pa || !pb) return null;
          const faded = !!emphasize?.length && !(emphasize.includes(e.a) && emphasize.includes(e.b));
          const width = 0.75 + Math.sqrt(e.count / maxCount) * 4;
          return (
            <path
              key={i}
              d={`M ${pa.x} ${pa.y} Q ${cx} ${cy} ${pb.x} ${pb.y}`}
              fill="none"
              stroke="var(--slate)"
              strokeWidth={width}
              opacity={faded ? 0.15 : 0.45}
              onMouseMove={(ev) =>
                setTip({
                  x: ev.clientX,
                  y: ev.clientY,
                  label: `${countryName(e.a)} – ${countryName(e.b)} · ${e.count} real co-authored paper${e.count === 1 ? "" : "s"}`,
                })
              }
              onMouseLeave={() => setTip(null)}
            />
          );
        })}
        {shown.map((c) => {
          const p = pos.get(c)!;
          const faded = !!emphasize?.length && !emphasize.includes(c);
          return (
            <g key={c} opacity={faded ? 0.35 : 1} style={{ cursor: onSelectCountry ? "pointer" : "default" }} onClick={() => onSelectCountry?.(c)}>
              <circle cx={p.x} cy={p.y} r={5} fill={countryColor(c)} />
              <text
                x={p.x + (p.x > cx ? 8 : -8)}
                y={p.y + (p.y > cy ? 12 : -8)}
                textAnchor={p.x > cx ? "start" : "end"}
                fontSize={10}
                fill="var(--ink-2)"
              >
                {countryName(c)}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && <Tooltip x={tip.x} y={tip.y}>{tip.label}</Tooltip>}
      {omittedCountries > 0 && (
        <div className="trend-note" style={{ marginTop: 4, fontSize: 11 }}>
          Showing the {shown.length} most internationally-connected countries — +{omittedCountries} more with real,
          smaller collaboration counts (see the ranked pairs below).
        </div>
      )}
      <table className="lb" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th className="rank">#</th>
            <th>Country pair</th>
            <th className="right">Real co-authored papers</th>
          </tr>
        </thead>
        <tbody>
          {edges.slice(0, TOP_N_PAIRS).map((e, i) => (
            <tr key={`${e.a}-${e.b}`}>
              <td className="rank">{i + 1}</td>
              <td className="org-name">{countryName(e.a)} – {countryName(e.b)}</td>
              <td className="right count">{e.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {edges.length > TOP_N_PAIRS && (
        <div className="trend-note" style={{ marginTop: 6, fontSize: 11 }}>
          +{edges.length - TOP_N_PAIRS} more country pairs with real, smaller collaboration counts.
        </div>
      )}
      <div className="cap">
        an edge is one real paper whose authors' institutions span 2+ countries with resolvable data — domestic-only
        papers and works with no resolvable institution data (a disclosed gap for country attribution generally)
        contribute nothing here. This shows who has co-published, not a claim about who depends on whom.
      </div>
    </div>
  );
}
