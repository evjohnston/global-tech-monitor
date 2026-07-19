import type { OrgRow } from "../lib/aggregate.ts";
import { countryColor, countryName } from "../lib/countries.ts";

export function Leaderboard({
  rows,
  unit = "works",
  onSelect,
  activeOrg,
}: {
  rows: OrgRow[];
  unit?: string;
  onSelect?: (org: string) => void;
  activeOrg?: string | null;
}) {
  if (rows.length === 0) {
    return <div className="trend-empty">No institution data yet — populated once a live fetch runs.</div>;
  }
  return (
    <table className="lb">
      <thead>
        <tr>
          <th className="rank">#</th>
          <th>Institution</th>
          <th>Country</th>
          <th className="right">{unit}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={r.org}
            className={`${onSelect ? "clickable" : ""}${activeOrg === r.org ? " active" : ""}`}
            onClick={() => onSelect?.(r.org)}
            title={onSelect ? "Click to highlight this institution's entries in the pipeline" : undefined}
          >
            <td className="rank">{i + 1}</td>
            <td className="org-name">{r.org}</td>
            <td>
              <span className="actor-tag" style={{ background: countryColor(r.country) }}>
                {countryName(r.country)}
              </span>
            </td>
            <td className="right count">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
