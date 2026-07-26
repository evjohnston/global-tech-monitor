import { useState } from "react";
import type { Entry } from "../lib/types.ts";
import { countByCountryAndStage } from "../lib/aggregate.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

// Research (innovation) share vs. adoption share, per country — a real,
// available proxy for "does research leadership translate into adoption,"
// using the app's actual 4 stages rather than a company/capital axis this
// data can't attribute by country (see the plan's Context note on
// VcCompanyFunding/RdSpendPoint/CompanySnapshot having no country field).
// Bubble size is a real activity count (investment-stage entries), never a
// dollar figure blended across public/private sources. Clicking a bubble
// pins that country (opens the shared metadata drawer).
export function QuadrantChart({
  entries,
  emphasize,
  onSelectCountry,
}: {
  entries: Entry[];
  emphasize?: string[];
  onSelectCountry?: (country: string) => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; country: string } | null>(null);
  const byCountry = countByCountryAndStage(entries);
  const innovationTotal = Object.values(byCountry).reduce((s, c) => s + c.innovation, 0) || 1;
  const adoptionTotal = Object.values(byCountry).reduce((s, c) => s + c.adoption, 0) || 1;

  const points = Object.entries(byCountry)
    .map(([country, counts]) => ({
      country,
      x: (counts.innovation / innovationTotal) * 100,
      y: (counts.adoption / adoptionTotal) * 100,
      size: counts.investment,
      innovationCount: counts.innovation,
      adoptionCount: counts.adoption,
    }))
    .filter((p) => p.x > 0 || p.y > 0);

  if (points.length < 2) {
    return <div className="trend-empty">Not enough countries with both research and adoption activity yet to compare.</div>;
  }

  const maxX = Math.max(1, ...points.map((p) => p.x));
  const maxY = Math.max(1, ...points.map((p) => p.y));
  const maxSize = Math.max(1, ...points.map((p) => p.size));
  const maxAxis = Math.max(maxX, maxY);

  const W = 640, H = 400, pad = 24;
  const plotW = W - pad * 2, plotH = H - pad * 2;
  const x = (v: number) => pad + (v / maxX) * plotW;
  const y = (v: number) => H - pad - (v / maxY) * plotH;
  const r = (size: number) => 4 + Math.sqrt(size / maxSize) * 14;

  // Diagonal equal-share reference line — where research share equals
  // adoption share exactly. Drawn to the smaller of the two axis maxima so
  // it never exceeds the real plotted range.
  const diagEnd = Math.min(maxX, maxY) === maxAxis ? maxAxis : Math.min(maxX, maxY);

  return (
    <div>
      <div className="trend-note" style={{ marginBottom: 8 }}>
        x = share of tracked research output · y = share of tracked adoption activity · bubble = investment-stage entries · dashed line = equal share
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Research share vs adoption share by country">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--line)" />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--line)" />
        <line x1={x(0)} y1={y(0)} x2={x(diagEnd)} y2={y(diagEnd)} stroke="var(--line-2)" strokeDasharray="3 3" />
        {hoverPoint && (
          <>
            <line x1={pad} y1={hoverPoint.y} x2={W - pad} y2={hoverPoint.y} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
            <line x1={hoverPoint.x} y1={pad} x2={hoverPoint.x} y2={H - pad} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
          </>
        )}
        {points.map((p) => {
          const faded = !!emphasize?.length && !emphasize.includes(p.country);
          const px = x(p.x), py = y(p.y);
          return (
            <g
              key={p.country}
              opacity={faded ? 0.3 : 1}
              role={onSelectCountry ? "button" : undefined}
              tabIndex={onSelectCountry ? 0 : undefined}
              aria-label={onSelectCountry ? `${countryName(p.country)}: ${p.x.toFixed(1)}% research share, ${p.y.toFixed(1)}% adoption share` : undefined}
              style={{ cursor: onSelectCountry ? "pointer" : "default", outline: "none" }}
              onClick={() => onSelectCountry?.(p.country)}
              onKeyDown={(e) => { if (onSelectCountry && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelectCountry(p.country); } }}
            >
              <circle
                cx={px}
                cy={py}
                r={r(p.size)}
                fill={countryColor(p.country)}
                fillOpacity={0.65}
                stroke={countryColor(p.country)}
                onMouseMove={(e) => {
                  setHoverPoint({ x: px, y: py, country: p.country });
                  setTip({
                    x: e.clientX,
                    y: e.clientY,
                    label: `${countryName(p.country)} · ${p.x.toFixed(1)}% research share (${p.innovationCount}) · ${p.y.toFixed(1)}% adoption share (${p.adoptionCount}) · gap ${(p.x - p.y).toFixed(1)}pt · ${p.size} investment-stage entries`,
                  });
                }}
                onMouseLeave={() => { setHoverPoint(null); setTip(null); }}
              />
              <text x={px + r(p.size) + 4} y={py} fontSize={9.5} dominantBaseline="middle" fill="var(--ink-2)">
                {countryName(p.country)}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && <Tooltip x={tip.x} y={tip.y}>{tip.label}</Tooltip>}
      <div className="cap">
        position = share of tracked output, not raw counts · bubble size = investment-stage entry count (grants and
        disclosed private rounds counted together as real activity, never a blended dollar total)
      </div>
    </div>
  );
}
