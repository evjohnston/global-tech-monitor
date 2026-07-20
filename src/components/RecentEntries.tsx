import type { Entry } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { countryColor, countryName } from "../lib/countries.ts";

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

// NSF issues one award PER collaborating institution on the same
// "Collaborative Research: ..." project — real, distinct award ids and
// dollar amounts, not a scraping duplicate. Left alone, that reads as the
// same grant appearing 3-6x in a row here, since this view only shows
// title/country/stage. Groups same-title/same-stage siblings into one row
// (representative entry, real institution count, real summed amount)
// rather than either hiding the repetition's real siblings entirely or
// dropping the "duplicates" and losing the funding they represent.
function groupSiblings(entries: Entry[]): Array<Entry & { siblingCount: number; siblingAmount: number }> {
  const byKey = new Map<string, Entry & { siblingCount: number; siblingAmount: number }>();
  for (const e of entries) {
    const key = `${e.stage}|${e.title.trim().toLowerCase()}`;
    const cur = byKey.get(key);
    if (cur) { cur.siblingCount++; cur.siblingAmount += e.amountUsd ?? 0; }
    else byKey.set(key, { ...e, siblingCount: 1, siblingAmount: e.amountUsd ?? 0 });
  }
  return [...byKey.values()];
}

export function RecentEntries({ entries, limit = 6, onSelect }: { entries: Entry[]; limit?: number; onSelect?: (entry: Entry) => void }) {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  const rows = groupSiblings(sorted).slice(0, limit);
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
          <tr
            key={e.id}
            className="clickable"
            onClick={() => onSelect?.(e)}
            title={e.siblingCount > 1 ? `${e.siblingCount} collaborating institutions — click for one representative award's details` : "Click for details"}
          >
            <td className="org-name" style={{ maxWidth: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {e.title}{e.siblingCount > 1 ? ` · +${e.siblingCount - 1} more` : ""}
            </td>
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
