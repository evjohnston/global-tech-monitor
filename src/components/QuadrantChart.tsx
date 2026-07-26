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
// dollar figure blended across public/private sources.
export function QuadrantChart({ entries, emphasize }: { entries: Entry[]; emphasize?: string[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const byCountry = countByCountryAndStage(entries);
  const innovationTotal = Object.values(byCountry).reduce((s, c) => s + c.innovation, 0) || 1;
  const adoptionTotal = Object.values(byCountry).reduce((s, c) => s + c.adoption, 0) || 1;

  const points = Object.entries(byCountry)
    .map(([country, counts]) => ({
      country,
      x: (counts.innovation / innovationTotal) * 100,
      y: (counts.adoption / adoptionTotal) * 100,
      size: counts.investment,
    }))
    .filter((p) => p.x > 0 || p.y > 0);

  if (points.length < 2) {
    return <div className="trend-empty">Not enough countries with both research and adoption activity yet to compare.</div>;
  }

  const maxX = Math.max(1, ...points.map((p) => p.x));
  const maxY = Math.max(1, ...points.map((p) => p.y));
  const maxSize = Math.max(1, ...points.map((p) => p.size));

  const W = 640, H = 400, pad = 24;
  const plotW = W - pad * 2, plotH = H - pad * 2;
  const x = (v: number) => pad + (v / maxX) * plotW;
  const y = (v: number) => H - pad - (v / maxY) * plotH;
  const r = (size: number) => 4 + Math.sqrt(size / maxSize) * 14;

  return (
    <div>
      <div className="trend-note" style={{ marginBottom: 8 }}>
        x = share of tracked research output · y = share of tracked adoption activity · bubble = investment-stage entries
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Research share vs adoption share by country">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--line)" />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--line)" />
        {points.map((p) => {
          const faded = !!emphasize?.length && !emphasize.includes(p.country);
          return (
            <g key={p.country} opacity={faded ? 0.3 : 1}>
              <circle
                cx={x(p.x)}
                cy={y(p.y)}
                r={r(p.size)}
                fill={countryColor(p.country)}
                fillOpacity={0.65}
                stroke={countryColor(p.country)}
                onMouseMove={(e) =>
                  setTip({
                    x: e.clientX,
                    y: e.clientY,
                    label: `${countryName(p.country)} · ${p.x.toFixed(1)}% of research output · ${p.y.toFixed(1)}% of adoption activity · ${p.size} investment-stage entries`,
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
              <text x={x(p.x) + r(p.size) + 4} y={y(p.y)} fontSize={9.5} dominantBaseline="middle" fill="var(--ink-2)">
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
