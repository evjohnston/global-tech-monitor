import type { Entry } from "../lib/types.ts";
import { computeChangeLog, type ChangeLogItem } from "../lib/changeLog.ts";

// Every line is a real diff against a week-old reconstruction of the
// corpus (changeLog.ts), not a fabricated "what's new" summary. Renders
// nothing at all when there isn't 7 real days of history to diff against.
// Items carrying a drawerTarget/activateCountry are real, keyboard-
// activatable buttons that open the evidence behind the claim.
export function ChangeLog({ entries, onSelectItem }: { entries: Entry[]; onSelectItem?: (item: ChangeLogItem) => void }) {
  const items = computeChangeLog(entries);
  if (items.length === 0) return null;
  return (
    <div className="panel">
      <h3>Since the last update <span className="drop">trailing 7 days, real diffs</span></h3>
      <ul className="drawer-list">
        {items.map((it) => {
          const clickable = !!onSelectItem && (it.drawerTarget || it.activateCountry);
          return (
            <li key={it.key}>
              {clickable ? (
                <button className="drawer-link-btn changelog-item" onClick={() => onSelectItem!(it)}>{it.text}</button>
              ) : (
                it.text
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
