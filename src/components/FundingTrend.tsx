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
  const rawMax = Math.max(1, ...values);
  const rawMin = Math.min(...values);
  // A truncated, zoomed axis — not 0-to-max — when the real values cluster
  // in a narrow band far from zero (e.g. $95M-$108M): a full 0-based axis
  // there reads as a nearly flat line hugging the top with most of the
  // chart's height wasted as blank space. Floors at 0 rather than going
  // negative, and the break marks below make the truncation visible rather
  // than implying a false zero baseline.
  const truncated = rawMin > rawMax * 0.2;
  const min = truncated ? Math.max(0, rawMin * 0.92) : 0;
  const max = rawMax * 1.05;
  const range = Math.max(1, max - min);
  const color = STAGE_COLOR.investment;

  // 500:150 — wide-and-short so this renders inside the spec's 360-440px
  // panel-height range at real Money-dashboard content widths, not the
  // taller 500:200 this used to be (which rendered closer to 500-550px
  // tall at full content width).
  const W = 500, H = 150, padL = 46, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - min) / range) * plotH;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const changePct = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : null;

  // Marker + label plan: every real point gets a circle, but only a
  // readable subset gets a printed value next to it — first/last point plus
  // real local peaks/troughs, thinned by a minimum pixel gap so two close
  // values never collide (mechanically labeling every point breaks down
  // once points sit a few px apart, which this series will do as trend[]
  // keeps accumulating one point per day).
  const lastIdx = points.length - 1;
  const labelGap = 42;
  const isExtreme = (i: number) =>
    i > 0 && i < lastIdx &&
    ((values[i] > values[i - 1] && values[i] > values[i + 1]) ||
      (values[i] < values[i - 1] && values[i] < values[i + 1]));
  const candidates = [0, ...values.map((_v, i) => i).filter(isExtreme), lastIdx];
  const labelIdx: number[] = [];
  for (const i of candidates) {
    if (labelIdx.length === 0 || x(i) - x(labelIdx[labelIdx.length - 1]) >= labelGap) labelIdx.push(i);
  }
  // The latest value is the one figure this chart must always surface —
  // swap out a too-close neighbor rather than ever dropping it.
  if (labelIdx[labelIdx.length - 1] !== lastIdx) {
    if (labelIdx.length && x(lastIdx) - x(labelIdx[labelIdx.length - 1]) < labelGap) labelIdx.pop();
    labelIdx.push(lastIdx);
  }
  const aboveFor = (i: number) => {
    const prev = values[Math.max(0, i - 1)];
    const next = values[Math.min(lastIdx, i + 1)];
    if (values[i] >= prev && values[i] >= next) return true; // peak (or rising edge)
    if (values[i] <= prev && values[i] <= next) return false; // trough (or falling edge)
    return i % 2 === 0;
  };
  // Point 0 sits in the same x column as the y-axis min/max tick labels —
  // push its value label toward whichever half of the chart ISN'T that
  // axis label, rather than the usual peak/trough rule, so it never
  // collides with them.
  const above0 = (values[0] - min) / range <= 0.5;
  const aboveY = (py: number) => Math.max(7, py - 7);
  const belowY = (py: number) => Math.min(133, py + 9);

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
      <div className="trend-note" style={{ marginBottom: 4 }}>
        {fmtUsd(lastVal)} latest{changePct != null && Math.abs(changePct) >= 1 ? ` · ${changePct > 0 ? "+" : ""}${changePct.toFixed(0)}% since ${points[0].date}` : ""}
        {truncated && " · axis truncated to the real range, not zero-based"}
      </div>
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
        <text x={padL - 4} y={H - padB} textAnchor="end" fontSize="9" fill="var(--mist)">{truncated ? fmtUsd(min) : "$0"}</text>
        <path d={line} fill="none" stroke={color} strokeWidth="2" />
        {hover && (
          <line x1={x(hover.i)} y1={padT} x2={x(hover.i)} y2={H - padB} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="2 2" />
        )}
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(values[i])} r={i === lastIdx ? 3 : 2} fill={color} />
        ))}
        {labelIdx.map((i) => {
          const cy = y(values[i]);
          const anchor = i === 0 ? "start" : i === lastIdx ? "end" : "middle";
          const lx = i === 0 ? x(i) + 4 : i === lastIdx ? x(i) - 4 : x(i);
          const above = i === 0 ? above0 : aboveFor(i);
          return (
            <text key={`v-${points[i].date}`} x={lx} y={above ? aboveY(cy) : belowY(cy)} textAnchor={anchor} fontSize="7.5" fill={color}>
              {fmtUsd(values[i])}
            </text>
          );
        })}
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
