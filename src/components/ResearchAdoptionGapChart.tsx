import { researchAdoptionGap } from "../lib/stackComparison.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import type { Entry } from "../lib/types.ts";
import { EmptyState } from "./ChartFrame.tsx";

// "Research share minus adoption share" — a diverging bar per country
// around a zero line. Positive means more research activity than
// adoption activity is tracked for that country; this is an explicit,
// labeled measure of two independent shares, NOT a conversion rate or a
// claim that research causes adoption.
export function ResearchAdoptionGapChart({ entries, countries }: { entries: Entry[]; countries: string[] }) {
  const rows = researchAdoptionGap(entries, countries).filter((r) => r.researchSharePct > 0 || r.adoptionSharePct > 0);
  if (rows.length === 0) return <EmptyState>Not enough tracked research or adoption activity yet to compare.</EmptyState>;
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.gapPct)));

  return (
    <div className="gap-chart">
      {rows.map((r) => {
        const widthPct = (Math.abs(r.gapPct) / maxAbs) * 50;
        return (
          <div key={r.country} className="gap-chart-row">
            <div className="gap-chart-label">{countryName(r.country)}</div>
            <div className="gap-chart-track">
              <div className="gap-chart-zero" />
              {r.gapPct >= 0 ? (
                <div className="gap-chart-bar gap-chart-bar-pos" style={{ width: `${widthPct}%`, background: countryColor(r.country) }} />
              ) : (
                <div className="gap-chart-bar gap-chart-bar-neg" style={{ width: `${widthPct}%`, background: countryColor(r.country) }} />
              )}
            </div>
            <div className="gap-chart-value num">{r.gapPct > 0 ? "+" : ""}{r.gapPct.toFixed(0)}pt</div>
          </div>
        );
      })}
      <div className="cap">research share of tracked activity minus adoption share of tracked activity, each computed independently — positive means more tracked research than adoption, not a conversion rate or a causal pipeline</div>
    </div>
  );
}
