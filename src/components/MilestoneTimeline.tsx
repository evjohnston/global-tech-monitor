import { useMemo, useState } from "react";
import type { Entry } from "../lib/types.ts";
import { countryColor, countryName } from "../lib/countries.ts";

type Filter = "all" | "verified" | "reported";

const MAIN_PAGE_LIMIT = 5;

// A real, labeled, chronological milestone list — deliberately not a news
// feed (no infinite scroll of raw items) and not a fabricated categorical
// breakdown: this app's data model doesn't carry a hardware-platform or
// milestone-type field, so grouping stays to what's real — organization,
// country, date, and verification tier (seeded = hand-verified against a
// source URL, auto = RSS-classified, weakest tier, labeled "reported").
// Capped to 5 on the main dashboard — the full list lives in the record
// explorer, not as a 25-row scroll here.
export function MilestoneTimeline({ entries, onSelectEntry, onViewAll }: { entries: Entry[]; onSelectEntry: (entry: Entry) => void; onViewAll?: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = useMemo(() => {
    const rows = filter === "all" ? entries : entries.filter((e) => (filter === "verified" ? e.provenance === "seeded" : e.provenance === "auto"));
    return [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, MAIN_PAGE_LIMIT);
  }, [entries, filter]);

  const verifiedCount = entries.filter((e) => e.provenance === "seeded").length;
  const reportedCount = entries.filter((e) => e.provenance === "auto").length;

  if (entries.length === 0) return <div className="trend-empty">No tracked scaling milestones yet.</div>;

  return (
    <div>
      <div className="tab-bar">
        <button className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({entries.length})</button>
        <button className="chip" aria-pressed={filter === "verified"} onClick={() => setFilter("verified")}>Verified ({verifiedCount})</button>
        <button className="chip" aria-pressed={filter === "reported"} onClick={() => setFilter("reported")}>Reported ({reportedCount})</button>
      </div>
      <ol className="milestone-timeline">
        {filtered.map((e) => (
          <li key={e.id} className="milestone-row clickable" onClick={() => onSelectEntry(e)} tabIndex={0} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelectEntry(e); } }}>
            <span className="milestone-date num">{e.date || "undated"}</span>
            <span className="actor-tag" style={{ background: countryColor(e.country) }}>{countryName(e.country)}</span>
            <span className="milestone-title">{e.title}</span>
            {e.org && <span className="milestone-org">{e.org}</span>}
            <span className={`seeded${e.provenance === "auto" ? " auto" : ""}`}>{e.provenance === "seeded" ? "verified" : e.provenance === "auto" ? "reported" : "live"}</span>
          </li>
        ))}
      </ol>
      {entries.length > filtered.length && (
        <button className="viewall" onClick={onViewAll}>View all {entries.length} scaling records →</button>
      )}
    </div>
  );
}
