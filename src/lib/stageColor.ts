import type { Stage } from "./types.ts";

// One color per pipeline stage, reused everywhere a stage needs a swatch
// (the entries-by-stage pie, the stage-composition chart, anything else
// added later) — a single definition so a new chart can't drift from the
// pipeline columns' own colors. This is the STAGE semantic (see
// countries.ts's countryColor() for the unrelated per-COUNTRY semantic —
// the two are deliberately different color spaces, don't conflate them).
export const STAGE_COLOR: Record<Stage, string> = {
  innovation: "var(--cn)",
  scaling: "var(--eu)",
  adoption: "var(--us)",
  investment: "var(--ink-2)",
};
