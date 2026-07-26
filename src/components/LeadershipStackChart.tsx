import { stackComparison, STACK_METRICS } from "../lib/stackComparison.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import type { Entry } from "../lib/types.ts";
import { EmptyState } from "./ChartFrame.tsx";

// Grouped bars, one row per pipeline stage, one bar per selected country —
// answers "who leads which part of the system" at a glance for 2-4
// countries (defaults to US/China from the caller). Plain HTML/CSS bars,
// not SVG — this app's existing BarRow uses the same approach, and a
// fixed 2-4 country row never grows into a giant chart regardless of how
// many countries exist in the underlying data.
export function LeadershipStackChart({ entries, countries }: { entries: Entry[]; countries: string[] }) {
  if (countries.length < 2) return <EmptyState>Select at least two countries to compare leadership across the stack.</EmptyState>;
  const rows = stackComparison(entries, countries);
  const maxShare = Math.max(1, ...rows.flatMap((r) => STACK_METRICS.map((m) => r.shareByMetric[m.key])));

  return (
    <div className="stack-chart">
      <div className="stack-chart-legend">
        {countries.map((c) => (
          <span key={c} className="legend-item">
            <span className="swatch" style={{ background: countryColor(c) }} />
            {countryName(c)}
          </span>
        ))}
      </div>
      {STACK_METRICS.map((m) => (
        <div key={m.key} className="stack-chart-row">
          <div className="stack-chart-row-label">{m.label}</div>
          <div className="stack-chart-bars">
            {rows.map((r) => {
              const pct = r.shareByMetric[m.key];
              return (
                <div key={r.country} className="stack-chart-bar-track" title={`${countryName(r.country)} — ${m.label}: ${pct.toFixed(0)}%`}>
                  <div className="stack-chart-bar" style={{ width: `${(pct / maxShare) * 100}%`, background: countryColor(r.country) }} />
                  <span className="stack-chart-bar-value num">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="cap">share of tracked activity within each stage, computed independently per stage — not a weighted composite</div>
    </div>
  );
}
