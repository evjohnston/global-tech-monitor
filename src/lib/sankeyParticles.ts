// Shared geometry for scattering dots throughout a Sankey ribbon's real
// area — not just a handful crawling along the centerline. A d3-sankey
// link rendered via sankeyLinkHorizontal is a cubic Bezier whose control
// points share each endpoint's y (a horizontal-tangent S-curve): that
// means the curve's y(t) reduces to a smoothstep interpolation between
// y0/y1, while x(t) uses the true cubic with both control points sitting
// at the horizontal midpoint. Used to place dots anywhere inside the
// ribbon's real vertical thickness at a given point along its length,
// matching a dot-density flow style instead of a thin animated trickle.
export function sankeyPointAt(x0: number, y0: number, x1: number, y1: number, t: number): { x: number; y: number } {
  const xm = (x0 + x1) / 2;
  const mt = 1 - t;
  const x = mt ** 3 * x0 + 3 * mt ** 2 * t * xm + 3 * mt * t ** 2 * xm + t ** 3 * x1;
  const smooth = t * t * (3 - 2 * t);
  const y = y0 + (y1 - y0) * smooth;
  return { x, y };
}

export interface ScatterDot { x: number; y: number; r: number; delay: number; dur: number }

const MAX_DOTS_PER_LINK = 60;

// Deterministic per-link scatter — a stable hash, not Math.random(). A
// real reroll on every render would make the whole texture flicker or
// jump each time React re-renders for an unrelated reason (a hover
// elsewhere, a filter change). count scales with the link's real value
// relative to the diagram's max, capped so one huge link can't render
// hundreds of circles.
export function scatterDots(x0: number, y0: number, x1: number, y1: number, width: number, count: number, linkSeed: number): ScatterDot[] {
  const n = Math.max(0, Math.min(MAX_DOTS_PER_LINK, Math.round(count)));
  const dots: ScatterDot[] = [];
  for (let i = 0; i < n; i++) {
    const h1 = Math.sin(linkSeed * 12.9898 + i * 78.233) * 43758.5453;
    const t = h1 - Math.floor(h1);
    const h2 = Math.sin(linkSeed * 39.346 + i * 11.135) * 24634.634;
    const u = (h2 - Math.floor(h2)) * 2 - 1; // -1..1, lateral position within the ribbon
    const h3 = Math.sin(linkSeed * 78.234 + i * 45.164) * 12321.987;
    const jitter = h3 - Math.floor(h3);
    const { x, y } = sankeyPointAt(x0, y0, x1, y1, t);
    dots.push({
      x,
      y: y + u * (width / 2) * 0.85,
      r: 1.0 + Math.abs(u) * 0.7,
      delay: jitter * 3,
      dur: 2.2 + jitter * 1.6,
    });
  }
  return dots;
}
