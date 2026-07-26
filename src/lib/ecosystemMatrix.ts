import type { Entry, Stage } from "./types.ts";
import { countByCountry, countryShares, investmentUsdByCountry, rankOf } from "./aggregate.ts";
import { entriesAsOf, daysAgo } from "./history.ts";

export type MatrixMetric = "research" | "scaling" | "adoption" | "money";
const METRIC_STAGE: Record<MatrixMetric, Stage> = { research: "innovation", scaling: "scaling", adoption: "adoption", money: "investment" };
export const MATRIX_METRICS: { key: MatrixMetric; label: string }[] = [
  { key: "research", label: "Research" },
  { key: "scaling", label: "Scaling" },
  { key: "adoption", label: "Adoption" },
  { key: "money", label: "Money" },
];

const CHANGE_WINDOW_DAYS = 42;
// A generous ceiling, not a display cap — EcosystemMatrix.tsx decides how
// many rows to actually show (default top 8, expandable), this just
// bounds real runaway cases (e.g. a vertical with 190 countries each
// carrying one record) from computing a genuinely unbounded row set.
const TOP_N_ROWS = 40;

export interface MatrixCell {
  rank: number | null;
  share: number; // % of tracked activity in this stage (dollar share for money, entry share otherwise)
  count: number; // real tracked entry count, always shown regardless of what share/rank are computed from
  changePt: number | null; // point-share change over CHANGE_WINDOW_DAYS, null if not enough history
  coverage: "ok" | "no-feed" | "no-records" | "undisclosed-only";
}

export interface MatrixRow {
  country: string;
  totalActivity: number;
  cells: Record<MatrixMetric, MatrixCell>;
}

export interface EcosystemMatrix {
  rows: MatrixRow[];
  omittedCountries: number;
}

// Real per-country activity across all 4 stages, one row per country, one
// column per stage — the Overview's main comparison. "Money" here is the
// investment stage's real per-country Entry data (NSF grants + hand-
// verified private funding rounds, both of which DO carry a real country),
// deliberately NOT the company-level VcCompanyFunding/CompanySnapshot/
// RdSpendPoint pools used in Track Money's other panels — those have no
// country field at all (see CLAUDE.md), so using them here would mean
// fabricating a country for a company-level record. A "money" cell with
// zero tracked entries is labeled "no comparable public feed" rather than
// a verdict on that country's real spending — NSF's own coverage is
// US/EU-weighted by construction (no PRC feed exists), the same caveat
// this app discloses everywhere else it touches investment data. A country
// with a real tracked record but no disclosed dollar figure (e.g. a bare
// news mention with no amount) gets its own "undisclosed-only" coverage
// state rather than being folded into "no comparable public feed" — the
// two mean different things (no coverage at all vs. real coverage with a
// missing number).
export function buildEcosystemMatrix(entries: Entry[], now = new Date()): EcosystemMatrix {
  const past = entriesAsOf(entries, daysAgo(CHANGE_WINDOW_DAYS, now));
  const hasHistory = past.length > 0;

  const entryCountsByMetric: Record<MatrixMetric, Record<string, number>> = {
    research: countByCountry(entries, "innovation"),
    scaling: countByCountry(entries, "scaling"),
    adoption: countByCountry(entries, "adoption"),
    money: countByCountry(entries, "investment"),
  };
  const pastEntryCountsByMetric: Record<MatrixMetric, Record<string, number>> = {
    research: countByCountry(past, "innovation"),
    scaling: countByCountry(past, "scaling"),
    adoption: countByCountry(past, "adoption"),
    money: countByCountry(past, "investment"),
  };
  // Rank/share source per metric — money uses real disclosed dollars,
  // everything else uses entry count (a paper/milestone/adoption record
  // are all roughly comparable "one unit," so count is a fair proxy there;
  // money's entries vary by orders of magnitude in real size, so count
  // isn't).
  const rankBasisByMetric: Record<MatrixMetric, Record<string, number>> = {
    research: entryCountsByMetric.research,
    scaling: entryCountsByMetric.scaling,
    adoption: entryCountsByMetric.adoption,
    money: investmentUsdByCountry(entries),
  };
  const pastRankBasisByMetric: Record<MatrixMetric, Record<string, number>> = {
    research: pastEntryCountsByMetric.research,
    scaling: pastEntryCountsByMetric.scaling,
    adoption: pastEntryCountsByMetric.adoption,
    money: investmentUsdByCountry(past),
  };
  const sharesByMetric: Record<MatrixMetric, Record<string, number>> = {
    research: countryShares(rankBasisByMetric.research),
    scaling: countryShares(rankBasisByMetric.scaling),
    adoption: countryShares(rankBasisByMetric.adoption),
    money: countryShares(rankBasisByMetric.money),
  };
  const pastSharesByMetric: Record<MatrixMetric, Record<string, number>> = {
    research: countryShares(pastRankBasisByMetric.research),
    scaling: countryShares(pastRankBasisByMetric.scaling),
    adoption: countryShares(pastRankBasisByMetric.adoption),
    money: countryShares(pastRankBasisByMetric.money),
  };

  const allCountries = new Set<string>();
  for (const m of Object.keys(entryCountsByMetric) as MatrixMetric[]) {
    for (const c of Object.keys(entryCountsByMetric[m])) allCountries.add(c);
  }

  const rows: MatrixRow[] = [...allCountries].map((country) => {
    const cells = {} as Record<MatrixMetric, MatrixCell>;
    let totalActivity = 0;
    for (const metric of Object.keys(METRIC_STAGE) as MatrixMetric[]) {
      const count = entryCountsByMetric[metric][country] ?? 0;
      const rankBasisValue = rankBasisByMetric[metric][country] ?? 0;
      totalActivity += count;
      const changePt = hasHistory ? (sharesByMetric[metric][country] ?? 0) - (pastSharesByMetric[metric][country] ?? 0) : null;
      let coverage: MatrixCell["coverage"];
      if (rankBasisValue > 0) coverage = "ok";
      else if (metric === "money") coverage = count > 0 ? "undisclosed-only" : "no-feed";
      else coverage = "no-records";
      cells[metric] = {
        rank: rankBasisValue > 0 ? rankOf(rankBasisByMetric[metric], country) : null,
        share: sharesByMetric[metric][country] ?? 0,
        count,
        changePt,
        coverage,
      };
    }
    return { country, totalActivity, cells };
  });

  rows.sort((a, b) => b.totalActivity - a.totalActivity);
  return { rows: rows.slice(0, TOP_N_ROWS), omittedCountries: Math.max(0, rows.length - TOP_N_ROWS) };
}
