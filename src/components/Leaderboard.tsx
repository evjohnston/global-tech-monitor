import type { Actor } from "../lib/types.ts";
import type { OrgRow } from "../lib/aggregate.ts";
import { ACTOR_LABEL } from "../lib/aggregate.ts";

const ACTOR_VAR: Record<Actor, string> = {
  us: "var(--us)", cn: "var(--cn)", eu: "var(--eu)", other: "var(--other)",
};
const ACTOR_SHORT: Record<Actor, string> = { us: "US", cn: "CN", eu: "EU", other: "—" };

export function Leaderboard({ rows, unit = "works" }: { rows: OrgRow[]; unit?: string }) {
  if (rows.length === 0) {
    return <div className="trend-empty">No institution data yet — populated once a live fetch runs.</div>;
  }
  return (
    <table className="lb">
      <thead>
        <tr>
          <th className="rank">#</th>
          <th>Institution</th>
          <th>Actor</th>
          <th className="right">{unit}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.org}>
            <td className="rank">{i + 1}</td>
            <td className="org-name">{r.org}</td>
            <td>
              <span className="actor-tag" style={{ background: ACTOR_VAR[r.actor] }}>
                {ACTOR_SHORT[r.actor]} · {ACTOR_LABEL[r.actor]}
              </span>
            </td>
            <td className="right count">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
