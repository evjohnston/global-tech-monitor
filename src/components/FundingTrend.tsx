import { useRef, useState, type MouseEvent } from "react";
import type { TrendPoint } from "../lib/types.ts";
import { Tooltip } from "./Tooltip.tsx";
import { fmtUsd } from "../lib/format.ts";
import { STAGE_COLOR } from "../lib/stageColor.ts";

// Real disclosed investment (NSF grants, trailing 21d window) recorded once
// per day since fundingUsd was added to TrendPoint (2026-07-20) — this data
// has been accumulating since then but had no chart of its own until now.
// Older trend points lack fundingUsd entirely (optional field, not zero),
// so they're filtered out rather than plotted as a false dip to $0.
export function FundingTrend({ trend }: { trend: TrendPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const points = trend.filter((p) => p.fundingUsd != null) as (TrendPoint & { fundingUsd: number })[];

  if (points.length < 2) {
    return <div className="trend-empty">Funding trend builds as the daily fetch accumulates.</div>;
  }

  const values = points.map((p) => p.fundingUsd);
  const max = Math.max(1, ...values);

  const W = 500, H = 200, padL = 42, padR = 10, padT = 14, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - v / max) * plotH;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const color = STAGE_COLOR.investment;

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - padL) / plotW) * (points.length - 1));
    setHover({ i: Math.max(0, Math.min(points.length - 1, i)), x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Disclosed investment over time"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--line)" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--line)" />
        <text x={padL - 4} y={padT + 4} textAnchor="end" fontSize="9" fill="var(--mist)">{fmtUsd(max)}</text>
        <text x={padL - 4} y={H - padB} textAnchor="end" fontSize="9" fill="var(--mist)">$0</text>
        <path d={line} fill="none" stroke={color} strokeWidth="2" />
        {hover && (
          <line x1={x(hover.i)} y1={padT} x2={x(hover.i)} y2={H - padB} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="2 2" />
        )}
        <circle cx={x(points.length - 1)} cy={y(values[values.length - 1])} r="3" fill={color} />
        <text x={padL} y={H - 6} fontSize="9" fill="var(--mist)">{points[0].date}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="var(--mist)">{points[points.length - 1].date}</text>
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          {points[hover.i].date} · {fmtUsd(values[hover.i])} disclosed
        </Tooltip>
      )}
    </>
  );
}
