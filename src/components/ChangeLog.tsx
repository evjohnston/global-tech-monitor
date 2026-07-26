import type { Entry } from "../lib/types.ts";
import { computeChangeLog } from "../lib/changeLog.ts";

// Every line is a real diff against a week-old reconstruction of the
// corpus (changeLog.ts), not a fabricated "what's new" summary. Renders
// nothing at all when there isn't 7 real days of history to diff against.
export function ChangeLog({ entries }: { entries: Entry[] }) {
  const items = computeChangeLog(entries);
  if (items.length === 0) return null;
  return (
    <div className="panel">
      <h3>Since the last update <span className="drop">trailing 7 days, real diffs</span></h3>
      <ul className="drawer-list">
        {items.map((it) => (
          <li key={it.key}>{it.text}</li>
        ))}
      </ul>
    </div>
  );
}
