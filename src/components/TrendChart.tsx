import type { Actor, TrendPoint } from "../lib/types.ts";

const ACTOR_COLOR: Record<Actor, string> = {
  us: "var(--slate-deep)",
  cn: "var(--hoover-red)",
  eu: "var(--warm-gray)",
  other: "var(--silver)",
};
const ACTOR_LABEL: Record<Actor, string> = {
  us: "US", cn: "China", eu: "Europe", other: "Other",
};
const ORDER: Actor[] = ["us", "cn", "eu", "other"];

export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  // Need at least two points for a line to mean anything.
  if (trend.length < 2) {
    return (
      <div className="trend-empty">
        Trend builds as the daily fetch accumulates. One point recorded so far —
        the line appears once there are at least two days of data.
      </div>
    );
  }

  const W = 720, H = 240, padL = 34, padR = 12, padT = 14, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // y-axis: share of that day's innovation works (percent), so lines are
  // comparable even as total volume changes day to day.
  const shares = trend.map((p) => {
    const total = ORDER.reduce((s, a) => s + p.counts[a], 0) || 1;
    return {
      date: p.date,
      pct: Object.fromEntries(ORDER.map((a) => [a, (p.counts[a] / total) * 100])) as Record<Actor, number>,
    };
  });

  const x = (i: number) => padL + (i / (trend.length - 1)) * plotW;
  const y = (pct: number) => padT + (1 - pct / 100) * plotH;

  const line = (actor: Actor) =>
    shares.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(s.pct[actor]).toFixed(1)}`).join(" ");

  const gridVals = [0, 25, 50, 75, 100];

  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Actor share of quantum preprints over time" width="100%">
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--ink-dim)">{v}%</text>
          </g>
        ))}
        {ORDER.map((a) => (
          <path key={a} d={line(a)} fill="none" stroke={ACTOR_COLOR[a]} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {/* endpoint dots on the latest reading */}
        {ORDER.map((a) => (
          <circle key={a} cx={x(trend.length - 1)} cy={y(shares[shares.length - 1].pct[a])} r="3" fill={ACTOR_COLOR[a]} />
        ))}
        <text x={padL} y={H - 6} fontSize="9" fill="var(--ink-dim)">{shares[0].date}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="var(--ink-dim)">{shares[shares.length - 1].date}</text>
      </svg>
      <figcaption className="trend-legend">
        {ORDER.map((a) => (
          <span key={a} className="legend-item">
            <span className="swatch" style={{ background: ACTOR_COLOR[a] }} />
            {ACTOR_LABEL[a]}
          </span>
        ))}
        <span className="trend-note">share of quant-ph preprints by author-affiliation country</span>
      </figcaption>
    </figure>
  );
}
