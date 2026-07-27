// Shared label-placement math for hand-rolled SVG line/point charts
// (TrendChart/FundingTrend/RdSpendTrend/BumpChart/QuadrantChart) — this app
// has no charting library, so these small geometric helpers are the
// difference between a label overlapping real long data (a long country
// name, a dense multi-decade point series) and one that reads cleanly.

// Truncates real text to fit a real available pixel width, using a
// hand-measured average glyph width (charPx) rather than a real text-
// measurement API (SVG has no synchronous one without a DOM round-trip).
// reserveChars leaves room for a fixed suffix that isn't part of `text`
// itself (e.g. BumpChart's trailing " · #N" rank).
export function truncateToWidth(text: string, availablePx: number, charPx: number, reserveChars = 0): { text: string; width: number } {
  const budget = Math.max(3, Math.floor(availablePx / charPx) - reserveChars);
  const shown = text.length > budget ? `${text.slice(0, budget - 1)}…` : text;
  return { text: shown, width: Math.min(text.length, budget) * charPx };
}

// Real data points a line chart should print a value next to, out of many —
// first/last plus real local peaks/troughs, greedily thinned by a minimum
// pixel gap so two close values never collide (mechanically labeling every
// point breaks down once points sit a few px apart). The most-recent point
// is always kept, evicting a too-close neighbor rather than ever dropping
// the one figure a reader most wants.
export function pickDeclutteredLabelIndices(values: number[], x: (i: number) => number, minGap: number): number[] {
  const lastIdx = values.length - 1;
  const isExtreme = (i: number) =>
    i > 0 && i < lastIdx &&
    ((values[i] > values[i - 1] && values[i] > values[i + 1]) ||
      (values[i] < values[i - 1] && values[i] < values[i + 1]));
  const candidates = [0, ...values.map((_v, i) => i).filter(isExtreme), lastIdx];
  const labelIdx: number[] = [];
  for (const i of candidates) {
    if (labelIdx.length === 0 || x(i) - x(labelIdx[labelIdx.length - 1]) >= minGap) labelIdx.push(i);
  }
  if (labelIdx[labelIdx.length - 1] !== lastIdx) {
    if (labelIdx.length && x(lastIdx) - x(labelIdx[labelIdx.length - 1]) < minGap) labelIdx.pop();
    labelIdx.push(lastIdx);
  }
  return labelIdx;
}

// Whether a point's label reads more naturally above its marker (a real
// local peak, or the parity fallback on a monotonic run) or below (a real
// local trough) — the shared core of the placement rule; callers layer
// their own edge-case override on top (e.g. forcing the first/last point
// above because that column is already used by an axis tick label).
export function isPeakOrRising(values: number[], i: number, lastIdx: number): boolean {
  const prev = values[Math.max(0, i - 1)];
  const next = values[Math.min(lastIdx, i + 1)];
  if (values[i] >= prev && values[i] >= next) return true;
  if (values[i] <= prev && values[i] <= next) return false;
  return i % 2 === 0;
}
