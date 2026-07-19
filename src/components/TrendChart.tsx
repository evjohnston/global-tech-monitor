import { useRef, useState, type MouseEvent } from "react";
import type { TrendPoint } from "../lib/types.ts";
import { projectCountryShares } from "../lib/aggregate.ts";
import { countryName, countryColor } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

export function TrendChart({
  trend,
  countries,
  projectDays = 4,
}: {
  trend: TrendPoint[];
  countries: string[];
  projectDays?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number; projected: boolean } | null>(null);

  if (trend.length < 2 || countries.length === 0) {
    return (
      <div className="trend-empty">
        Trend builds as the daily fetch accumulates. One point recorded so far —
        the line appears once there are at least two days of data.
      </div>
    );
  }

  const order = countries;
  const colorOf = (code: string) => countryColor(code);

  const projection = projectCountryShares(trend, order, projectDays);
  const steps = projection ? projection[0].points.length : 0;
  const nHist = trend.length;
  const nTotal = nHist + steps;

  const W = 720, H = 240, padL = 30, padR = 12, padT = 14, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const shares = trend.map((p) => {
    const total = order.reduce((s, c) => s + (p.counts[c] ?? 0), 0) || 1;
    return {
      date: p.date,
      pct: Object.fromEntries(order.map((c) => [c, ((p.counts[c] ?? 0) / total) * 100])) as Record<string, number>,
    };
  });

  // Dynamic Y-axis: zoom into the real range instead of a fixed 0-100% —
  // with 4-6 countries splitting the pie, no single share usually gets
  // anywhere near 100%, so a fixed full-scale axis reads as flat lines
  // hugging the bottom. Round up to the nearest 10 and add 5pt headroom
  // above the highest real (historical or projected) point.
  const allVals = [
    ...shares.flatMap((s) => order.map((c) => s.pct[c])),
    ...(projection?.flatMap((p) => p.points) ?? []),
  ];
  const rawMax = Math.max(1, ...allVals);
  const yMax = Math.ceil((rawMax + 5) / 10) * 10;

  const x = (i: number) => padL + (i / Math.max(1, nTotal - 1)) * plotW;
  const y = (pct: number) => padT + (1 - pct / yMax) * plotH;

  const histLine = (code: string) =>
    shares.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(s.pct[code]).toFixed(1)}`).join(" ");

  const projLine = (code: string, points: number[]) => {
    const last = shares[shares.length - 1].pct[code];
    const all = [last, ...points];
    return all.map((v, i) => `${i === 0 ? "M" : "L"} ${x(nHist - 1 + i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  };

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - padL) / plotW) * (nTotal - 1));
    const clamped = Math.max(0, Math.min(nTotal - 1, i));
    setHover({ i: clamped, x: e.clientX, y: e.clientY, projected: clamped >= nHist });
  }

  const gridVals = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  return (
    <figure style={{ margin: 0 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Country share of quantum preprints over time, with projection"
        width="100%"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--mist)">{Math.round(v)}%</text>
          </g>
        ))}
        {projection && (
          <rect x={x(nHist - 1)} y={padT} width={W - padR - x(nHist - 1)} height={plotH} fill="var(--panel-2)" opacity="0.6" />
        )}
        {order.map((c) => (
          <path key={c} d={histLine(c)} fill="none" stroke={colorOf(c)} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {projection?.map(({ country, points }) => (
          <path key={country} d={projLine(country, points)} fill="none" stroke={colorOf(country)} strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
        ))}
        {order.map((c) => (
          <circle key={c} cx={x(nHist - 1)} cy={y(shares[shares.length - 1].pct[c])} r="3" fill={colorOf(c)} />
        ))}
        {hover && (
          <line x1={x(hover.i)} y1={padT} x2={x(hover.i)} y2={H - padB} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="2 2" />
        )}
        <text x={padL} y={H - 6} fontSize="9" fill="var(--mist)">{shares[0].date}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="var(--mist)">
          {projection ? `${new Date(trend[0].date).getFullYear()}-12-31` : shares[shares.length - 1].date}
        </text>
        {projection && (
          <text x={x(nHist - 1) + 6} y={padT + 11} fontSize="9" fill="var(--mist)">projected to year end</text>
        )}
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>
            {hover.projected ? "Projected" : shares[hover.i]?.date}
          </div>
          {order.map((c) => {
            const v = hover.projected
              ? projection?.find((p) => p.country === c)?.points[hover.i - nHist]
              : shares[hover.i]?.pct[c];
            return v == null ? null : <div key={c}>{countryName(c)} {v.toFixed(1)}%</div>;
          })}
        </Tooltip>
      )}
      <figcaption className="trend-legend">
        {order.map((c) => (
          <span key={c} className="legend-item">
            <span className="swatch" style={{ background: colorOf(c) }} />
            {countryName(c)}
          </span>
        ))}
        <span className="trend-note">
          {projection ? "solid = measured, dashed = linear projection to year end" : "share of quant-ph preprints by institution country"}
        </span>
      </figcaption>
    </figure>
  );
}
