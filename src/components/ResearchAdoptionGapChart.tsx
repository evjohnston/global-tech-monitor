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
            <div className="gap-chart-value num">{(() => { const rounded = r.gapPct.toFixed(0); return `${rounded === "0" ? "" : r.gapPct > 0 ? "+" : ""}${rounded}pt`; })()}</div>
          </div>
        );
      })}
      {/* Real x-axis scale for the diverging track above: the bar geometry
          maps track-left/center/right to -maxAbs/0/+maxAbs exactly (see
          widthPct math), so these three ticks are the real domain, not
          invented round numbers. Reuses gap-chart-row's own grid so the
          ticks land under the track column precisely, with the label/value
          columns left blank rather than duplicating text next to them. */}
      <div className="gap-chart-row">
        <div />
        <div style={{ position: "relative", height: 12, fontSize: 10, color: "var(--mist)" }}>
          <span style={{ position: "absolute", left: 0 }}>-{maxAbs.toFixed(0)}pt</span>
          <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>0pt</span>
          <span style={{ position: "absolute", right: 0 }}>+{maxAbs.toFixed(0)}pt</span>
        </div>
        <div />
      </div>
      <div className="cap">research share of tracked activity minus adoption share of tracked activity, each computed independently — positive means more tracked research than adoption, not a conversion rate or a causal pipeline</div>
    </div>
  );
}
