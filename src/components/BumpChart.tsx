import { useMemo, useState } from "react";
import type { Entry } from "../lib/types.ts";
import { buildBumpData, type BumpMeasure } from "../lib/bumpChart.ts";
import { bumpChartClaim } from "../lib/claims.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

const MEASURES: { key: BumpMeasure; label: string }[] = [
  { key: "publications", label: "Publications" },
  { key: "patents", label: "Patents" },
  { key: "scaling", label: "Scaling" },
  { key: "adoption", label: "Adoption" },
  { key: "investment", label: "Investment" },
];
const MIN_LABEL_GAP = 12;
// Conservative Inter-at-10px average glyph width — bounds how much of a
// real country name the end label can print before it would run past the
// SVG's right edge. i18n-iso-countries' real names range far wider than
// the "US"/"China" cases this was originally sized for — e.g. "Taiwan,
// Province of China" (25 chars) — so the name is measured against this,
// not assumed to always fit.
const LABEL_CHAR_PX = 5.8;

// Real rank-over-time, reconstructed from entry dates (see bumpChart.ts) —
// same hand-rolled SVG approach as TrendChart.tsx (this app has no charting
// library, see CLAUDE.md), just plotting integer rank instead of percent
// share. The title is computed HERE, from the chart's own current measure
// (bumpChartClaim), not passed in as a static string from the caller — the
// bug this fixes was a title reading "publication rankings" while Patents/
// Scaling/Adoption/Investment was the actually-selected measure. When 1+
// countries are selected for comparison, they're always included in the
// series (buildBumpData's priorityCountries) even if outside the global
// top 8, backfilled with the real top-ranked countries as reference.
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
  const data = useMemo(() => buildBumpData(entries, measure, emphasize), [entries, measure, emphasize]);
  const title = useMemo(() => bumpChartClaim(entries, measure), [entries, measure]);

  const hasData = data.series.some((s) => s.ranks.some((r) => r != null));
  const maxRank = Math.max(1, ...data.series.flatMap((s) => s.ranks.filter((r): r is number => r != null)));

  const W = 720, H = 280, padL = 14, padR = 120, padT = 14, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.dates.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (rank: number) => padT + ((rank - 1) / Math.max(1, maxRank - 1)) * plotH;

  // Simple top-to-bottom collision avoidance on the end labels — sort by
  // natural y position, then push any label that would overlap the one
  // above it down just enough to clear.
  const labelPositions = useMemo(() => {
    const withLast = data.series
      .map((s) => {
        const last = [...s.ranks].reverse().find((r) => r != null);
        return last == null ? null : { country: s.country, rank: last, y: y(last) };
      })
      .filter((p): p is { country: string; rank: number; y: number } => p != null)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < withLast.length; i++) {
      if (withLast[i].y - withLast[i - 1].y < MIN_LABEL_GAP) withLast[i].y = withLast[i - 1].y + MIN_LABEL_GAP;
    }
    return new Map(withLast.map((p) => [p.country, p.y]));
  }, [data]);

  return (
    <div>
      <div className="chart-title">{title}</div>
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
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${title} — country rank over time, ${measure}`}>
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--line)" />
          {/* y-axis orientation only — no rank scale is a real Entry field the way each line's own "#N" end label
              is, so this states the direction (top = rank 1) rather than inventing tick gridlines for it. */}
          <text x={padL + 14} y={padT - 5} fontSize={8} fill="var(--mist)">top = rank 1 (highest count)</text>
          {data.dates.map((d, i) => (
            <text key={d} x={x(i)} y={H - padB + 14} fontSize={9} textAnchor="middle" fill="var(--mist)">{d.slice(5)}</text>
          ))}
          {data.series.map((s) => {
            const faded = !!emphasize?.length && !emphasize.includes(s.country);
            const points = s.ranks
              .map((r, i) => (r == null ? null : { i, r }))
              .filter((p): p is { i: number; r: number } => p != null);
            if (points.length === 0) return null;
            const d = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.r).toFixed(1)}`).join(" ");
            const last = points[points.length - 1];
            const hovered = hoverCountry === s.country;
            const labelY = labelPositions.get(s.country) ?? y(last.r);
            const rankSuffix = ` · #${last.r}`;
            const availPx = Math.max(20, W - (x(last.i) + 7) - 4);
            const nameBudget = Math.max(3, Math.floor(availPx / LABEL_CHAR_PX) - rankSuffix.length);
            const fullName = countryName(s.country);
            const shownName = fullName.length > nameBudget ? `${fullName.slice(0, nameBudget - 1)}…` : fullName;
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
                <line x1={x(last.i)} y1={y(last.r)} x2={x(last.i) + 6} y2={labelY} stroke={countryColor(s.country)} strokeWidth={0.75} opacity={0.5} />
                <text x={x(last.i) + 7} y={labelY} fontSize={10} dominantBaseline="middle" fill="var(--ink-2)" fontWeight={hovered ? 700 : 400}>
                  {shownName}{rankSuffix}
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
        (x-axis, MM-DD) · investment counts grants and disclosed private rounds together as activity, never their blended dollar totals
      </div>
    </div>
  );
}
