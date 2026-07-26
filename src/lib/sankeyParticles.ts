// Shared geometry for a Sankey ribbon's particle effect: many dots, each
// moving along its OWN lane through the ribbon's real thickness — not a
// sparse handful crawling the centerline (the original design) and not a
// dense but motionless scatter (an intermediate draft that looked right but
// dropped the movement, per direct feedback: "the particles aren't
// moving"). This gets both at once.
//
// A d3-sankey link rendered via sankeyLinkHorizontal is a cubic Bezier
// `M x0,y0 C xm,y0 xm,y1 x1,y1` (control points sitting at the horizontal
// midpoint, each sharing its endpoint's y). Bezier curves are affine —
// translating every one of those y-values by the same constant shifts the
// whole curve by that constant without changing its shape. So a dot's own
// lane is just that identical S-curve, offset vertically by a fixed lateral
// jitter — its own real path string, used directly as SVG animateMotion's
// `path` attribute (no separate referenced <path> element needed). Many
// dots on many lanes, staggered start times, reproduces a dense, filled
// ribbon at any single instant while every dot genuinely travels the flow's
// real direction and shape.
export interface MotionDot {
  pathD: string;
  r: number;
  delay: number;
  dur: number;
}

const MAX_DOTS_PER_LINK = 40;

// Deterministic per-link/per-dot scatter — a stable hash, not Math.random().
// A real reroll on every render would make the whole texture flicker or
// restart every time React re-renders for an unrelated reason (a hover
// elsewhere, a filter change). Count scales with the link's real value
// relative to the diagram's max, capped so one huge link can't spawn
// hundreds of concurrently-animating SMIL elements.
export function scatterMotionDots(x0: number, y0: number, x1: number, y1: number, width: number, count: number, linkSeed: number): MotionDot[] {
  const n = Math.max(0, Math.min(MAX_DOTS_PER_LINK, Math.round(count)));
  const xm = (x0 + x1) / 2;
  const dots: MotionDot[] = [];
  for (let i = 0; i < n; i++) {
    const h2 = Math.sin(linkSeed * 39.346 + i * 11.135) * 24634.634;
    const u = (h2 - Math.floor(h2)) * 2 - 1; // -1..1, this dot's fixed lateral lane within the ribbon
    const h3 = Math.sin(linkSeed * 78.234 + i * 45.164) * 12321.987;
    const jitter = h3 - Math.floor(h3);
    const offset = u * (width / 2) * 0.85;
    dots.push({
      pathD: `M${x0},${y0 + offset} C${xm},${y0 + offset} ${xm},${y1 + offset} ${x1},${y1 + offset}`,
      r: 1.5 + Math.abs(u) * 1.0,
      delay: jitter * 4.5,
      dur: 3.6 + jitter * 2.6,
    });
  }
  return dots;
}
