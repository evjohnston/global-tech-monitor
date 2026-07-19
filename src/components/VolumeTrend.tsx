import { useRef, useState, type MouseEvent } from "react";
import type { TrendPoint } from "../lib/types.ts";
import { Tooltip } from "./Tooltip.tsx";

export function VolumeTrend({ trend }: { trend: TrendPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  if (trend.length < 2) {
    return <div className="trend-empty">Volume trend builds as the daily fetch accumulates.</div>;
  }

  const totals = trend.map((p) => Object.values(p.counts).reduce((s, n) => s + n, 0));
  const max = Math.max(1, ...totals);

  const W = 500, H = 200, padL = 30, padR = 10, padT = 14, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i: number) => padL + (i / Math.max(1, trend.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - v / max) * plotH;
  const line = totals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - padL) / plotW) * (trend.length - 1));
    setHover({ i: Math.max(0, Math.min(trend.length - 1, i)), x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Total innovation-stage output over time"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--line)" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--line)" />
        <path d={line} fill="none" stroke="var(--us)" strokeWidth="2" />
        {hover && (
          <line x1={x(hover.i)} y1={padT} x2={x(hover.i)} y2={H - padB} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="2 2" />
        )}
        <circle cx={x(trend.length - 1)} cy={y(totals[totals.length - 1])} r="3" fill="var(--us)" />
        <text x={padL} y={H - 6} fontSize="9" fill="var(--mist)">{trend[0].date}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="var(--mist)">{trend[trend.length - 1].date}</text>
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          {trend[hover.i].date} · {totals[hover.i]} works
        </Tooltip>
      )}
    </>
  );
}
