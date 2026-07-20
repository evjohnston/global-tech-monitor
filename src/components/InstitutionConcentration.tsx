import type { OrgRow } from "../lib/aggregate.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { BarRow } from "./BarRow.tsx";

// Whether output is concentrated in a handful of labs or spread across many
// institutions is a structural fact this audience cares about more than
// the aggregate country number — the existing compact "Top institutions"
// panel only shows 6, this shows up to ~20. A treemap was the spec's first
// choice; a sized/colored bar list is the explicit fallback ("if a treemap
// is heavy") and reuses BarRow rather than adding a treemap layout
// dependency for one chart — see gtm-claude-code-spec.md Part 4. Bars are
// sized relative to the TOP row's count (not the sum of all rows), so the
// leading institution reads as a full bar and everyone else's relative
// concentration is visible against it.
//
// No citations column/metric here (or anywhere else in this app as of
// 2026-07-20) — checked against the real AI-vertical build, every visible
// row read 0, because OpenAlex citation counts take months to accrue and
// this corpus is days old. A metric that's currently indistinguishable
// from zero reads as broken, not as "not yet available."
export function InstitutionConcentration({ rows }: { rows: OrgRow[] }) {
  if (rows.length === 0) {
    return <div className="trend-empty">No institution data yet — populated on the next scheduled build.</div>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      {rows.map((r) => (
        <BarRow
          key={r.org}
          label={r.org}
          pct={(r.count / max) * 100}
          color={countryColor(r.country)}
          valueLabel={String(r.count)}
          detail={`${r.org} · ${countryName(r.country)} · ${r.count} tracked works`}
        />
      ))}
    </div>
  );
}
