import { useRef, useState, type MouseEvent } from "react";
import type { Actor, TrendPoint } from "../lib/types.ts";
import { projectShares } from "../lib/aggregate.ts";
import { Tooltip } from "./Tooltip.tsx";

const ACTOR_COLOR: Record<Actor, string> = {
  us: "var(--us)", cn: "var(--cn)", eu: "var(--eu)", other: "var(--other)",
};
const ACTOR_LABEL: Record<Actor, string> = { us: "US", cn: "China", eu: "Europe", other: "Other" };
const ORDER: Actor[] = ["us", "cn", "eu", "other"];

export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number; projected: boolean } | null>(null);

  if (trend.length < 2) {
    return (
      <div className="trend-empty">
        Trend builds as the daily fetch accumulates. One point recorded so far —
        the line appears once there are at least two days of data.
      </div>
    );
  }

  const projection = projectShares(trend);
  const steps = projection ? projection[0].points.length : 0;
  const nHist = trend.length;
  const nTotal = nHist + steps;

  const W = 720, H = 240, padL = 34, padR = 12, padT = 14, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const shares = trend.map((p) => {
    const total = ORDER.reduce((s, a) => s + p.counts[a], 0) || 1;
    return {
      date: p.date,
      pct: Object.fromEntries(ORDER.map((a) => [a, (p.counts[a] / total) * 100])) as Record<Actor, number>,
    };
  });

  const x = (i: number) => padL + (i / Math.max(1, nTotal - 1)) * plotW;
  const y = (pct: number) => padT + (1 - pct / 100) * plotH;

  const histLine = (actor: Actor) =>
    shares.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(s.pct[actor]).toFixed(1)}`).join(" ");

  const projLine = (actor: Actor, points: number[]) => {
    const last = shares[shares.length - 1].pct[actor];
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

  const gridVals = [0, 25, 50, 75, 100];

  return (
    <figure style={{ margin: 0 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Actor share of quantum preprints over time, with projection"
        width="100%"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--mist)">{v}%</text>
          </g>
        ))}
        {projection && (
          <rect x={x(nHist - 1)} y={padT} width={W - padR - x(nHist - 1)} height={plotH} fill="var(--panel-2)" opacity="0.6" />
        )}
        {ORDER.map((a) => (
          <path key={a} d={histLine(a)} fill="none" stroke={ACTOR_COLOR[a]} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {projection?.map(({ actor, points }) => (
          <path key={actor} d={projLine(actor, points)} fill="none" stroke={ACTOR_COLOR[actor]} strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
        ))}
        {ORDER.map((a) => (
          <circle key={a} cx={x(nHist - 1)} cy={y(shares[shares.length - 1].pct[a])} r="3" fill={ACTOR_COLOR[a]} />
        ))}
        {hover && (
          <line x1={x(hover.i)} y1={padT} x2={x(hover.i)} y2={H - padB} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="2 2" />
        )}
        <text x={padL} y={H - 6} fontSize="9" fill="var(--mist)">{shares[0].date}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="var(--mist)">{shares[shares.length - 1].date}</text>
        {projection && (
          <text x={x(nHist - 1) + 6} y={padT + 11} fontSize="9" fill="var(--mist)">projected</text>
        )}
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>
            {hover.projected ? "Projected" : shares[hover.i]?.date}
          </div>
          {ORDER.map((a) => {
            const v = hover.projected
              ? projection?.find((p) => p.actor === a)?.points[hover.i - nHist]
              : shares[hover.i]?.pct[a];
            return v == null ? null : <div key={a}>{ACTOR_LABEL[a]} {v.toFixed(1)}%</div>;
          })}
        </Tooltip>
      )}
      <figcaption className="trend-legend">
        {ORDER.map((a) => (
          <span key={a} className="legend-item">
            <span className="swatch" style={{ background: ACTOR_COLOR[a] }} />
            {ACTOR_LABEL[a]}
          </span>
        ))}
        <span className="trend-note">
          {projection ? "solid = measured, dashed = linear projection" : "share of quant-ph preprints by author-affiliation country"}
        </span>
      </figcaption>
    </figure>
  );
}
