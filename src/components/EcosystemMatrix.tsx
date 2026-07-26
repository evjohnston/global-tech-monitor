import { useMemo, useState } from "react";
import type { Entry } from "../lib/types.ts";
import { buildEcosystemMatrix, MATRIX_METRICS, type MatrixCell, type MatrixMetric } from "../lib/ecosystemMatrix.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import type { Dashboard } from "../lib/urlState.ts";

const METRIC_DASHBOARD: Record<MatrixMetric, Dashboard> = { research: "research", scaling: "scaling", adoption: "adoption", money: "money" };
const DEFAULT_ROWS = 8;

function CoverageText({ cell }: { cell: MatrixCell }) {
  if (cell.coverage === "no-feed") return <span className="matrix-coverage">No comparable public feed</span>;
  if (cell.coverage === "no-records") return <span className="matrix-coverage">Not covered</span>;
  if (cell.coverage === "undisclosed-only") return <span className="matrix-coverage">Tracked, amount undisclosed</span>;
  return null;
}

// The Overview's main comparison — replaces the role several disconnected
// visuals used to play (the research-vs-adoption scatter, stage-composition
// bars, the momentum table) with one table a reader can understand without
// hovering: rank + share + a bar + recent change + an explicit coverage
// state per cell, never a bare zero standing in for "no data." Defaults to
// the top 8 countries by total activity — real per-cell ranks are
// computed within each stage independently regardless of how many rows
// are shown, so an expand doesn't change any number, just how much of the
// same table is visible.
export function EcosystemMatrix({
  entries,
  compareCountries,
  onSelectCell,
}: {
  entries: Entry[];
  compareCountries?: string[];
  onSelectCell: (country: string, dashboard: Dashboard) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const matrix = useMemo(() => buildEcosystemMatrix(entries), [entries]);
  if (matrix.rows.length === 0) return <div className="trend-empty">Not enough tracked activity yet to compare countries.</div>;

  const displayRows = showAll ? matrix.rows : matrix.rows.slice(0, DEFAULT_ROWS);
  const hiddenCount = matrix.rows.length - displayRows.length;

  const maxShareByMetric: Record<MatrixMetric, number> = {
    research: Math.max(1, ...matrix.rows.map((r) => r.cells.research.share)),
    scaling: Math.max(1, ...matrix.rows.map((r) => r.cells.scaling.share)),
    adoption: Math.max(1, ...matrix.rows.map((r) => r.cells.adoption.share)),
    money: Math.max(1, ...matrix.rows.map((r) => r.cells.money.share)),
  };

  return (
    <div>
      <div className="matrix-scroll">
      <table className="lb matrix-table">
        <thead>
          <tr>
            <th>Country</th>
            {MATRIX_METRICS.map((m) => <th key={m.key} className="right">{m.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => {
            const faded = !!compareCountries?.length && !compareCountries.includes(row.country);
            const majorActor = row.country === "US" || row.country === "CN";
            return (
              <tr key={row.country} className={majorActor ? "matrix-row-major" : undefined} style={faded ? { opacity: 0.45 } : undefined}>
                <td className="org-name">
                  <span className="actor-tag" style={{ background: countryColor(row.country) }}>{countryName(row.country)}</span>
                </td>
                {MATRIX_METRICS.map((m) => {
                  const cell = row.cells[m.key];
                  return (
                    <td key={m.key} className="matrix-cell">
                      <button
                        className="matrix-cell-btn"
                        onClick={() => onSelectCell(row.country, METRIC_DASHBOARD[m.key])}
                        title={
                          m.key === "money"
                            ? `${countryName(row.country)} money: ${cell.share.toFixed(1)}% of disclosed dollars, ${cell.count} tracked record${cell.count === 1 ? "" : "s"} — click to open Money filtered to ${countryName(row.country)}`
                            : `Open ${m.label} filtered to ${countryName(row.country)}`
                        }
                      >
                        {cell.coverage === "ok" ? (
                          <>
                            <div className="matrix-cell-top">
                              <span className="rank">#{cell.rank}</span>
                              <span className="num">{cell.share.toFixed(0)}%</span>
                              {cell.changePt != null && Math.abs(cell.changePt) >= 0.5 && (
                                <span className={`matrix-change ${cell.changePt > 0 ? "up" : "down"}`}>
                                  {cell.changePt > 0 ? "+" : "−"}{Math.abs(cell.changePt).toFixed(1)}pt
                                </span>
                              )}
                            </div>
                            <div className="matrix-bar-track">
                              <div className="matrix-bar" style={{ width: `${(cell.share / maxShareByMetric[m.key]) * 100}%`, background: countryColor(row.country) }} />
                            </div>
                          </>
                        ) : (
                          <CoverageText cell={cell} />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {hiddenCount > 0 && (
        <button className="matrix-showall" onClick={() => setShowAll(true)}>Show all {matrix.rows.length} countries (+{hiddenCount} more)</button>
      )}
      {showAll && matrix.omittedCountries > 0 && (
        <div className="trend-note" style={{ marginTop: 6, fontSize: 11 }}>+{matrix.omittedCountries} more countries with real, smaller activity — see each dashboard's own country breakdown.</div>
      )}
      <div className="cap">
        Ranks are calculated independently within each dashboard — a country's Research rank has no bearing on its Money rank.
        Research/Scaling/Adoption rank by tracked entry count; Money ranks by real disclosed dollar total instead (NSF grants +
        disclosed private funding rounds) — entry count would let NSF's much larger number of smaller grants swamp a country
        with one real, large, disclosed private round, understating it. Money figures don't include the company-level
        public-markets/VC/R&D data shown in Track Money — those carry no country field. "No comparable public feed" reflects
        NSF's real US/EU-weighted coverage, not a claim that a country has zero public investment. "Tracked, amount undisclosed"
        means a real record exists for that country with no disclosed dollar figure to rank by.
      </div>
    </div>
  );
}
