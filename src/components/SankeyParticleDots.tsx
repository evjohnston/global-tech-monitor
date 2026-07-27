import type { MotionDot } from "../lib/sankeyParticles.ts";

// Shared particle-dot rendering for this app's Sankey diagrams — each dot
// travels its own lane (a copy of the ribbon's real curve, offset laterally
// — see sankeyParticles.ts) via animateMotion's inline path, with a paired
// opacity fade so it doesn't pop in/out at the ends. Staggered begin times
// across many lanes read as a continuously filled, genuinely moving ribbon
// rather than a few points crawling the centerline.
//
// baseOpacity is the only thing that varies per caller (each diagram tunes
// its own resting brightness) — the active/hover opacity values (0.95/0.05)
// are identical in every Sankey this app has, so they stay fixed here.
export function SankeyParticleDots({ dots, color, active, anyHover, baseOpacity }: {
  dots: MotionDot[];
  color: string;
  active: boolean;
  anyHover: boolean;
  baseOpacity: number;
}) {
  return (
    <>
      {dots.map((dot, pi) => {
        const base = anyHover ? (active ? 0.95 : 0.05) : baseOpacity;
        return (
          <circle key={pi} r={dot.r} fill={color} opacity={0}>
            <animateMotion path={dot.pathD} dur={`${dot.dur.toFixed(2)}s`} begin={`${dot.delay.toFixed(2)}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1" />
            <animate
              attributeName="opacity"
              values={`0;${base.toFixed(2)};${base.toFixed(2)};0`}
              keyTimes="0;0.15;0.85;1"
              dur={`${dot.dur.toFixed(2)}s`}
              begin={`${dot.delay.toFixed(2)}s`}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}
    </>
  );
}
