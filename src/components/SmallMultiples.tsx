import { useState } from "react";
import type { TrendPoint } from "../lib/types.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

// One small line panel per top-5 country, sharing a y-axis max across all
// of them so they're actually comparable side by side — a single overlaid
// multi-line chart at 5+ series is spaghetti (already true of the old
// country-share chart above this one), and small multiples are the
// standard fix. Daily buckets: `trend` is already one real point per day
// (see fetch-data.ts), no resampling needed at today's window length —
// switch to weekly buckets here if the window this reads ever grows past
// ~4 weeks, per gtm-claude-code-spec.md Part 3.
//
// Deliberately no trend language (no "accelerating"/"slowing", no slope
// arrows) — a handful of days is too short for "momentum" to mean
// anything real, and this component ships the shape, not a claim about it.
export function SmallMultiples({ trend, countries }: { trend: TrendPoint[]; countries: string[] }) {
  const [hover, setHover] = useState<{ country: string; i: number; x: number; y: number } | null>(null);

  if (trend.length < 2 || countries.length === 0) {
    return <div className="trend-empty">Builds as the scheduled fetch accumulates — needs at least two days of data.</div>;
  }

  const series = countries.map((c) => ({ country: c, values: trend.map((p) => p.counts[c] ?? 0) }));
  const sharedMax = Math.max(1, ...series.flatMap((s) => s.values));

  const W = 160, H = 64, pad = 6;
  const plotW = W - pad * 2;
  const plotH = H - pad * 2;
  const n = trend.length;
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * plotW;
  const y = (v: number) => pad + (1 - v / sharedMax) * plotH;

  return (
    <div className="smallmults">
      {series.map(({ country, values }) => {
        const line = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
        const last = values[values.length - 1];
        return (
          <div key={country} className="smallmult-panel">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              role="img"
              aria-label={`${countryName(country)} innovation output, trailing ${n} days`}
              onMouseMove={(e) => setHover({ country, i: n - 1, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
            >
              <path d={line} fill="none" stroke={countryColor(country)} strokeWidth="1.75" />
              <circle cx={x(n - 1)} cy={y(last)} r="2.5" fill={countryColor(country)} />
            </svg>
            <div className="smallmult-label">{countryName(country)}</div>
            <div className="smallmult-value num">{last}</div>
          </div>
        );
      })}
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          {countryName(hover.country)} · {trend[hover.i]?.date} · {trend[hover.i]?.counts[hover.country] ?? 0} works
        </Tooltip>
      )}
    </div>
  );
}
