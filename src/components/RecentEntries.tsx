import type { Entry } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { countryColor, countryName } from "../lib/countries.ts";

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
          <th>Country</th>
          <th>Stage</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id} className="clickable" onClick={() => window.open(e.url, "_blank", "noopener,noreferrer")} title="Open source">
            <td className="org-name" style={{ maxWidth: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <span className="actor-tag" style={{ background: countryColor(e.country) }}>
                {countryName(e.country)}
              </span>
            </td>
            <td style={{ whiteSpace: "nowrap" }}>{STAGE_LABEL[e.stage]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
