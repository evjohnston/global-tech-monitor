import { useState } from "react";
import type { Entry, Stage } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { STAGE_COLOR } from "../lib/stageColor.ts";
import { countByCountryAndStage } from "../lib/aggregate.ts";
import { countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

// Answers "does a country's innovation lead carry into scaling, adoption,
// investment, or stall" — a real composition question, not a flow. Each
// bar is normalized to ITS OWN 100% across the four stages, not raw
// counts — a raw-count version would just be "the US bar is huge," which
// says nothing about profile. Deliberately a stacked bar, not a Sankey:
// the four stages are different records (a paper is not the deployment or
// grant it might one day relate to), so drawing a ribbon between them
// would claim a real-world link this data doesn't support. See
// gtm-claude-code-spec.md Part 2 and CLAUDE.md's "country attribution is
// a lead, not a verdict."
export function StageComposition({ entries, topN = 6 }: { entries: Entry[]; topN?: number }) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const byCountry = countByCountryAndStage(entries);
  const rows = Object.entries(byCountry)
    .map(([country, counts]) => ({
      country,
      counts,
      total: STAGES.reduce((s, st) => s + counts[st.id], 0),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  if (rows.length === 0) {
    return <div className="trend-empty">No country-attributed entries yet.</div>;
  }

  return (
    <div>
      {rows.map((r) => (
        <div key={r.country} className="stagecomp-row">
          <span className="stagecomp-name">{countryName(r.country)}</span>
          <div className="stagecomp-track">
            {STAGES.map((s) => {
              const count = r.counts[s.id];
              if (count === 0) return null;
              const pct = (count / r.total) * 100;
              return (
                <div
                  key={s.id}
                  className="stagecomp-seg"
                  style={{ width: `${pct}%`, background: STAGE_COLOR[s.id] }}
                  onMouseMove={(e) =>
                    setTip({
                      x: e.clientX,
                      y: e.clientY,
                      label: `${countryName(r.country)} · ${s.label} · ${count} entries · ${pct.toFixed(0)}% of that country's tracked activity`,
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
              );
            })}
          </div>
          <span className="stagecomp-total num">{r.total}</span>
        </div>
      ))}
      <div className="trend-legend">
        {STAGES.map((s: { id: Stage; label: string }) => (
          <span key={s.id} className="legend-item">
            <span className="swatch" style={{ background: STAGE_COLOR[s.id] }} />
            {s.label}
          </span>
        ))}
      </div>
      {tip && <Tooltip x={tip.x} y={tip.y}>{tip.label}</Tooltip>}
    </div>
  );
}
