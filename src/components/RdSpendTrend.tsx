import { useRef, useState, type MouseEvent } from "react";
import type { RdSpendPoint } from "../lib/types.ts";
import { Tooltip } from "./Tooltip.tsx";
import { fmtUsd } from "../lib/format.ts";

// Real disclosed corporate R&D spend (SEC 10-K filings, src/lib/sources/
// secEdgar.ts), summed across this vertical's tickers. A different, private-
// capital counterpart to FundingTrend's public-NSF-funding line — see
// DataFile.rdSpend for why the two are kept as separate signals rather than
// merged into one total. Full multi-year history arrives on the first
// successful fetch (unlike FundingTrend, which needs daily accumulation),
// so this renders as soon as any data exists, not once trend[] has grown.
export function RdSpendTrend({ points }: { points: RdSpendPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  if (points.length < 2) {
    return <div className="trend-empty">No corporate R&D history available for this vertical's tickers.</div>;
  }

  const values = points.map((p) => p.totalUsd);
  const max = Math.max(1, ...values);
  const first = values[0];
  const last = values[values.length - 1];
  const changePct = first > 0 ? ((last - first) / first) * 100 : null;

  // 500:150 — wide-and-short so this renders inside the spec's ~360-440px
  // panel-height range at real Money-dashboard content widths.
  const W = 500, H = 150, padL = 42, padR = 10, padT = 12, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - v / max) * plotH;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const color = "var(--red)";

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
        {fmtUsd(last)} latest (FY{points[points.length - 1].fiscalYear}){changePct != null && Math.abs(changePct) >= 1 ? ` · ${changePct > 0 ? "+" : ""}${changePct.toFixed(0)}% since FY${points[0].fiscalYear}` : ""}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Corporate R&D spend over time"
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
        <text x={padL} y={H - 6} fontSize="9" fill="var(--mist)">{points[0].fiscalYear}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="var(--mist)">{points[points.length - 1].fiscalYear}</text>
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          FY{points[hover.i].fiscalYear} · {fmtUsd(values[hover.i])} · {points[hover.i].companies.length} companies
          {(() => {
            const capiqCount = points[hover.i].companies.filter((c) => c.source === "capiq").length;
            return capiqCount > 0 ? ` (${capiqCount} via S&P Capital IQ)` : "";
          })()}
        </Tooltip>
      )}
    </>
  );
}
