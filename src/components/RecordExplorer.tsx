import { useEffect, useMemo, useState } from "react";
import type { Entry, Stage } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { Card } from "./Card.tsx";
import { EmptyState } from "./ChartFrame.tsx";

type SortKey = "date" | "amount" | "relevance";
const SORTS: { key: SortKey; label: string; compare: (a: Entry, b: Entry) => number }[] = [
  { key: "date", label: "Date", compare: (a, b) => (a.date < b.date ? 1 : -1) },
  { key: "amount", label: "Amount", compare: (a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0) },
  { key: "relevance", label: "Relevance", compare: (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) },
];

// A single full-height record browser for one stage's complete entry list —
// replaces per-column internal scrolling (StageColumn caps its own inline
// list and links here for "the rest") with one real search+sort surface
// instead of four permanently-visible nested scrollbars.
export function RecordExplorer({
  stage,
  entries,
  onClose,
  onSelectEntry,
}: {
  stage: Stage;
  entries: Entry[];
  onClose: () => void;
  onSelectEntry: (entry: Entry) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const meta = STAGES.find((s) => s.id === stage)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? entries.filter((e) => e.title.toLowerCase().includes(q) || e.org.toLowerCase().includes(q)) : entries;
    const compare = SORTS.find((s) => s.key === sortKey)!.compare;
    return [...rows].sort(compare);
  }, [entries, query, sortKey]);

  return (
    <div className="record-explorer-backdrop" onClick={onClose}>
      <div className="record-explorer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`All ${meta.label} records`}>
        <div className="record-explorer-head">
          <span className="lbl">{meta.label} · {entries.length} {entries.length === 1 ? "record" : "records"}</span>
          <button className="ghost-btn" onClick={onClose}>✕ close (esc)</button>
        </div>
        <div className="record-explorer-controls">
          <input
            className="record-explorer-search"
            type="search"
            placeholder="Search title or organization…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search records"
          />
          <div className="tab-bar">
            {SORTS.map((s) => (
              <button key={s.key} className="chip" aria-pressed={sortKey === s.key} onClick={() => setSortKey(s.key)}>
                Sort: {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="record-explorer-body">
          {filtered.length === 0 ? (
            <EmptyState>No records match this search — try widening the filters or date range.</EmptyState>
          ) : (
            filtered.map((e) => <Card key={e.id} entry={e} onSelect={onSelectEntry} />)
          )}
        </div>
      </div>
    </div>
  );
}
