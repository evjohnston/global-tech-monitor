import { useMemo, useState } from "react";
import type { Entry } from "../lib/types.ts";
import { buildBumpData, type BumpMeasure } from "../lib/bumpChart.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

const MEASURES: { key: BumpMeasure; label: string }[] = [
  { key: "publications", label: "Publications" },
  { key: "patents", label: "Patents" },
  { key: "scaling", label: "Scaling" },
  { key: "adoption", label: "Adoption" },
  { key: "investment", label: "Investment" },
];

// Real rank-over-time, reconstructed from entry dates (see bumpChart.ts) —
// same hand-rolled SVG approach as TrendChart.tsx (this app has no charting
// library, see CLAUDE.md), just plotting integer rank instead of percent
// share. `emphasize` fades every other country when a comparison selection
// is active, same convention as the other charts that take it. Clicking a
// country's line pins it (opens the shared metadata drawer via
// onSelectCountry) — same click model as the map and every other chart.
export function BumpChart({
  entries,
  emphasize,
  onSelectCountry,
}: {
  entries: Entry[];
  emphasize?: string[];
  onSelectCountry?: (country: string) => void;
}) {
  const [measure, setMeasure] = useState<BumpMeasure>("publications");
  const [hoverCountry, setHoverCountry] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; country: string; rank: number; date: string } | null>(null);
  const data = useMemo(() => buildBumpData(entries, measure), [entries, measure]);

  const hasData = data.series.some((s) => s.ranks.some((r) => r != null));
  const maxRank = Math.max(1, ...data.series.flatMap((s) => s.ranks.filter((r): r is number => r != null)));

  const W = 720, H = 260, padL = 14, padR = 96, padT = 14, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.dates.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (rank: number) => padT + ((rank - 1) / Math.max(1, maxRank - 1)) * plotH;

  return (
    <div>
      <div className="tab-bar">
        {MEASURES.map((m) => (
          <button key={m.key} className="chip" aria-pressed={measure === m.key} onClick={() => setMeasure(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      {!hasData ? (
        <div className="trend-empty">Not enough dated entries yet to reconstruct rank history for this measure.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Country rank over time, ${measure}`}>
          {data.series.map((s) => {
            const faded = !!emphasize?.length && !emphasize.includes(s.country);
            const points = s.ranks
              .map((r, i) => (r == null ? null : { i, r }))
              .filter((p): p is { i: number; r: number } => p != null);
            if (points.length === 0) return null;
            const d = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.r).toFixed(1)}`).join(" ");
            const last = points[points.length - 1];
            const hovered = hoverCountry === s.country;
            return (
              <g
                key={s.country}
                opacity={faded && !hovered ? 0.25 : 1}
                role={onSelectCountry ? "button" : undefined}
                tabIndex={onSelectCountry ? 0 : undefined}
                aria-label={onSelectCountry ? `${countryName(s.country)}, rank ${last.r}` : undefined}
                style={{ cursor: onSelectCountry ? "pointer" : "default", outline: "none" }}
                onClick={() => onSelectCountry?.(s.country)}
                onKeyDown={(e) => { if (onSelectCountry && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelectCountry(s.country); } }}
                onMouseEnter={() => setHoverCountry(s.country)}
                onMouseLeave={() => { setHoverCountry(null); setTip(null); }}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, country: s.country, rank: last.r, date: data.dates[data.dates.length - 1] })}
              >
                <path d={d} fill="none" stroke={countryColor(s.country)} strokeWidth={hovered ? 3.5 : faded ? 1.5 : 2.5} strokeLinejoin="round" />
                {points.map((p) => (
                  <circle key={p.i} cx={x(p.i)} cy={y(p.r)} r={hovered ? 4 : 3} fill={countryColor(s.country)} />
                ))}
                <text x={x(last.i) + 7} y={y(last.r)} fontSize={10} dominantBaseline="middle" fill="var(--ink-2)" fontWeight={hovered ? 700 : 400}>
                  {countryName(s.country)} · #{last.r}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {tip && (
        <Tooltip x={tip.x} y={tip.y}>
          {countryName(tip.country)} · #{tip.rank} · {tip.date}{onSelectCountry ? " · click for profile" : ""}
        </Tooltip>
      )}
      <div className="cap">
        rank reconstructed from real entry dates at {n} points across the trailing 90 days, not a stored daily series
        · investment counts grants and disclosed private rounds together as activity, never their blended dollar totals
      </div>
    </div>
  );
}
