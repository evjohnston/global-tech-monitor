import type { RdSpendPoint } from "./types.ts";
import { tickerProfile, type ExposureClass } from "./companyCategory.ts";

// The R&D chart's honesty problem, quantified rather than caveated.
//
// DataFile.rdSpend sums each vertical's tickers' TOTAL company R&D, because
// that is the only figure SEC EDGAR actually publishes — no filer breaks R&D
// out by technology. CLAUDE.md has flagged the consequence since the ticker
// lists were broadened: the chart "reads more like 'total R&D of companies
// with some exposure to this vertical' than 'R&D spent on this vertical'
// specifically," with a real fix needing per-company weighting or a
// pure-play-only mode. This module is that fix, taking the second route.
//
// Weighting was the alternative and was rejected. Assigning Microsoft a
// notional "12% of R&D is AI" would manufacture a number no filing supports,
// which this project doesn't do. Exposure class is already a real, per-ticker,
// hand-assigned judgement in companyCategory.ts, so partitioning by it adds
// no new estimate — it just stops a reader inferring one.
//
// The measured share is the point. On the shipped data:
//   quantum   pure-plays are  0.23% of a $198.9B headline ($451M of real
//             quantum-dedicated R&D against IBM, Google and Microsoft's
//             entire budgets)
//   AI        0.00% — there are no pure-play public AI companies at all
//   biotech  20.92% — therapeutics companies genuinely are pure-plays
//   space     4.00%
// A reader told "$198.9B of quantum R&D" is being overstated by more than
// two orders of magnitude. Stating 0.23% costs nothing and fixes that.

export type RdExposureMode = "all" | "pure-play";

export interface ExposureSlice {
  exposure: ExposureClass;
  companies: number;
  totalUsd: number;
  sharePct: number;
}

// Descending by spend, so the largest contributor to the headline reads
// first — which is the thing a reader is trying to find out.
export function exposureBreakdown(verticalId: string, point: RdSpendPoint): ExposureSlice[] {
  const acc = new Map<ExposureClass, { companies: number; totalUsd: number }>();
  for (const c of point.companies) {
    const e = tickerProfile(verticalId, c.symbol).exposure;
    const cur = acc.get(e) ?? { companies: 0, totalUsd: 0 };
    acc.set(e, { companies: cur.companies + 1, totalUsd: cur.totalUsd + c.amountUsd });
  }
  const total = point.companies.reduce((s, c) => s + c.amountUsd, 0);
  return [...acc.entries()]
    .map(([exposure, v]) => ({ exposure, ...v, sharePct: total > 0 ? (100 * v.totalUsd) / total : 0 }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

// null when this vertical has no pure-play filer in the point at all, which
// is a different statement from 0% and has to read differently. AI is the
// live case: every AI-exposed public company is diversified, so there is no
// pure-play figure to compare against rather than a vanishingly small one.
export function pureplayShare(
  verticalId: string,
  point: RdSpendPoint,
): { pureplayUsd: number; totalUsd: number; sharePct: number; companies: number } | null {
  const pure = point.companies.filter((c) => tickerProfile(verticalId, c.symbol).exposure === "pure-play");
  if (pure.length === 0) return null;
  const pureplayUsd = pure.reduce((s, c) => s + c.amountUsd, 0);
  const totalUsd = point.companies.reduce((s, c) => s + c.amountUsd, 0);
  return {
    pureplayUsd,
    totalUsd,
    sharePct: totalUsd > 0 ? (100 * pureplayUsd) / totalUsd : 0,
    companies: pure.length,
  };
}

// Recompute the series across pure-plays only.
//
// A fiscal year with no pure-play filer is DROPPED, never plotted as zero.
// The distinction is load-bearing here: IonQ, Rigetti and D-Wave weren't
// public filers before 2021-2022, so quantum's early years have no pure-play
// data at all, and a $0 point would read as "they spent nothing that year"
// rather than "nobody was measurable yet." Same reasoning as
// trimIncompleteTail in secEdgar.ts, which drops a trailing year rather than
// showing a total that looks like spending collapsed.
export function restrictToPurePlay(verticalId: string, points: RdSpendPoint[]): RdSpendPoint[] {
  const out: RdSpendPoint[] = [];
  for (const p of points) {
    const companies = p.companies.filter((c) => tickerProfile(verticalId, c.symbol).exposure === "pure-play");
    if (companies.length === 0) continue;
    out.push({ ...p, companies, totalUsd: companies.reduce((s, c) => s + c.amountUsd, 0) });
  }
  return out;
}

export function applyExposureMode(
  verticalId: string,
  points: RdSpendPoint[],
  mode: RdExposureMode,
): RdSpendPoint[] {
  return mode === "pure-play" ? restrictToPurePlay(verticalId, points) : points;
}
