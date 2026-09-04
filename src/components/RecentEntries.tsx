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

// A future-dated entry is not more recent than today, and this panel answers
// "what is newest". Real cases in the shipped data on 2026-09-04:
// biotechnology led with a Zenodo dataset dated 2027-02-23 — six months out,
// upstream metadata error — sitting above that day's genuine Watchmaker
// Genomics and ZymoChem news, and AI led with a 2027-01-01 AAAI conference
// paper.
//
// Clamping rather than filtering, because the entries are real and some are
// legitimately future-dated: journals assign forward issue dates, and NSF
// grants and federal contracts are awarded before they start. Three such
// entries are in the current data and all three are correct. Hiding them
// would lose real records; letting them lead the feed asserts they already
// happened. Clamping to today puts them among today's items instead of above
// them, and each row still shows its own real date.
function effectiveRecency(e: Entry, today: string): string {
  return e.date > today ? today : e.date;
}

// Exported so the ordering is testable directly rather than by scraping
// rendered markup — it is the whole behaviour of this panel.
export function byRecency(today: string) {
  return (a: Entry, b: Entry): number => {
    const ea = effectiveRecency(a, today);
    const eb = effectiveRecency(b, today);
    if (ea !== eb) return ea < eb ? 1 : -1;
    // Same effective day. Clamping alone was not enough: a future-dated
    // entry ties with today and then STILL led the feed, because the sort is
    // stable and it already sat first. Something that has actually happened
    // outranks something that has not. Returning 0 on a true tie also makes
    // this a total order; the original comparator never returned 0, leaving
    // equal-dated entries in an engine-dependent order.
    return (a.date > today ? 1 : 0) - (b.date > today ? 1 : 0);
  };
}

export function RecentEntries({ entries, limit = 6, onSelect }: { entries: Entry[]; limit?: number; onSelect?: (entry: Entry) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  // Returns 0 on a tie so the sort is a total order — the previous comparator
  // never returned 0, which left equal-dated entries in an arbitrary and
  // engine-dependent order.
  const sorted = [...entries].sort(byRecency(today));
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
