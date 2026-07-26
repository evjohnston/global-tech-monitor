import { useRef, useState, type MouseEvent } from "react";
import type { TrendPoint } from "../lib/types.ts";
import { countryName, countryColor } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

// Measured-only — no forward projection. A linear extrapolation used to
// run out to year end here; removed 2026-07-20 because it routinely landed
// a single country at ~100% share by year end off as little as 6 days of
// real history, and which country depended on the build day. For an
// audience that will cite this, a chart that can silently show something
// that dramatic off that little data is worse than not projecting at all —
// see gtm-claude-code-spec.md Part 0.3. Bring projection back only once
// there's a real multi-week series to extrapolate from, and even then
// render it as a bounded band, not a single confident line.
export function TrendChart({
  trend,
  countries,
  emphasize,
}: {
  trend: TrendPoint[];
  countries: string[];
  emphasize?: string[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  if (trend.length < 2 || countries.length === 0) {
    return (
      <div className="trend-empty">
        Trend builds as the scheduled fetch accumulates. One point recorded so far —
        the line appears once there are at least two days of data.
      </div>
    );
  }

  const order = countries;
  const colorOf = (code: string) => countryColor(code);

  const nHist = trend.length;

  const W = 720, H = 240, padL = 30, padR = 12, padT = 14, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Trailing 7-day rolling sum, not a single day's raw counts — a source
  // outage on one day (confirmed by hand, 2026-07-21: OpenAlex failed over
  // to arXiv, which structurally carries almost no country data, so that
  // day's country-attributed total collapsed to ~1 while true volume was
  // normal) used to read as one country instantly at 0% and another at
  // 100%, then reverting the next day. A rolling window means one degraded
  // day contributes at most 1/7th of the weight behind any point, instead
  // of being the entire denominator for that day's chart position.
  const ROLL = 7;
  const shares = trend.map((_: TrendPoint, i: number) => {
    const window = trend.slice(Math.max(0, i - ROLL + 1), i + 1);
    const rolled = Object.fromEntries(order.map((c) => [c, window.reduce((s, p) => s + (p.counts[c] ?? 0), 0)]));
    const total = order.reduce((s, c) => s + rolled[c], 0) || 1;
    return {
      date: trend[i].date,
      pct: Object.fromEntries(order.map((c) => [c, (rolled[c] / total) * 100])) as Record<string, number>,
    };
  });

  // Dynamic Y-axis: zoom into the real range instead of a fixed 0-100% —
  // with 4-6 countries splitting the pie, no single share usually gets
  // anywhere near 100%, so a fixed full-scale axis reads as flat lines
  // hugging the bottom. Round up to the nearest 10 and add 5pt headroom
  // above the highest real recorded point.
  const allVals = shares.flatMap((s) => order.map((c) => s.pct[c]));
  const rawMax = Math.max(1, ...allVals);
  const yMax = Math.ceil((rawMax + 5) / 10) * 10;

  const x = (i: number) => padL + (i / Math.max(1, nHist - 1)) * plotW;
  const y = (pct: number) => padT + (1 - pct / yMax) * plotH;

  const histLine = (code: string) =>
    shares.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(s.pct[code]).toFixed(1)}`).join(" ");

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - padL) / plotW) * (nHist - 1));
    const clamped = Math.max(0, Math.min(nHist - 1, i));
    setHover({ i: clamped, x: e.clientX, y: e.clientY });
  }

  const gridVals = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  return (
    <figure style={{ margin: 0 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Country share of tracked innovation output over time, trailing 7-day rolling average"
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
        {order.map((c) => {
          const faded = !!emphasize?.length && !emphasize.includes(c);
          return <path key={c} d={histLine(c)} fill="none" stroke={colorOf(c)} strokeWidth="2" strokeLinejoin="round" opacity={faded ? 0.25 : 1} />;
        })}
        {order.map((c) => {
          const faded = !!emphasize?.length && !emphasize.includes(c);
          return <circle key={c} cx={x(nHist - 1)} cy={y(shares[shares.length - 1].pct[c])} r="3" fill={colorOf(c)} opacity={faded ? 0.25 : 1} />;
        })}
        {hover && (
          <line x1={x(hover.i)} y1={padT} x2={x(hover.i)} y2={H - padB} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="2 2" />
        )}
        <text x={padL} y={H - 6} fontSize="9" fill="var(--mist)">{shares[0].date}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="var(--mist)">{shares[shares.length - 1].date}</text>
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{shares[hover.i]?.date}</div>
          {order.map((c) => {
            const v = shares[hover.i]?.pct[c];
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
        <span className="trend-note">trailing 7-day share of tracked innovation output by country, recorded only — smoothed to absorb single-day ingestion gaps, not projected forward</span>
      </figcaption>
    </figure>
  );
}
