import type { Entry } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";

const ACTOR_VAR: Record<Entry["actor"], string> = {
  us: "var(--us)", cn: "var(--cn)", eu: "var(--eu)", other: "var(--other)",
};
const ACTOR_SHORT: Record<Entry["actor"], string> = { us: "US", cn: "CN", eu: "EU", other: "—" };
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

export function RecentEntries({ entries, limit = 6 }: { entries: Entry[]; limit?: number }) {
  const rows = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
  if (rows.length === 0) {
    return <div className="trend-empty">No entries for this filter.</div>;
  }
  return (
    <table className="lb">
      <thead>
        <tr>
          <th>Title</th>
          <th>Actor</th>
          <th>Stage</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id} className="clickable" onClick={() => window.open(e.url, "_blank", "noopener,noreferrer")} title="Open source">
            <td className="org-name" style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</td>
            <td><span className="actor-tag" style={{ background: ACTOR_VAR[e.actor] }}>{ACTOR_SHORT[e.actor]}</span></td>
            <td>{STAGE_LABEL[e.stage]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
