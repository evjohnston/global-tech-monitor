import { useMemo, useRef, useState } from "react";
import type { Entry, Stage, StageNote } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { Card } from "./Card.tsx";
import { NoteCard } from "./NoteCard.tsx";

const STAGE_VAR: Record<Stage, string> = {
  innovation: "var(--cn)", scaling: "var(--eu)", adoption: "var(--us)", investment: "var(--slate)",
};
const STAGE_NUM: Record<Stage, string> = {
  innovation: "01", scaling: "02", adoption: "03", investment: "04",
};

interface TypeFilterOption {
  key: string;
  label: string;
  test: (e: Entry) => boolean;
}
interface SortOption {
  key: string;
  label: string;
  compare: (a: Entry, b: Entry) => number;
}

// One real type distinction per stage — no stage gets a fake button with
// nothing behind it. Innovation splits on `source` (paper vs patent, both
// "live" institution-attributed). Scaling/adoption's `source` is constant
// per stage (always "milestone"/"deployment") — the real split there is
// `provenance` (seeded = hand-verified milestone, "Verified"; auto = RSS-
// classified, "News" — same framing as the badges Card.tsx already shows).
// Investment splits on `source` too (grant = NSF live award, news =
// Google-News auto-classified funding story).
const TYPE_FILTERS: Record<Stage, TypeFilterOption[]> = {
  innovation: [
    { key: "paper", label: "Paper", test: (e) => e.source === "paper" || e.source === "arxiv" },
    { key: "patent", label: "Patent", test: (e) => e.source === "patent" },
  ],
  scaling: [
    { key: "verified", label: "Verified", test: (e) => e.provenance === "seeded" },
    { key: "news", label: "News", test: (e) => e.provenance === "auto" },
  ],
  adoption: [
    { key: "verified", label: "Verified", test: (e) => e.provenance === "seeded" },
    { key: "news", label: "News", test: (e) => e.provenance === "auto" },
  ],
  investment: [
    { key: "grant", label: "Grant", test: (e) => e.source === "grant" },
    { key: "news", label: "News", test: (e) => e.source === "news" },
  ],
};

// Only investment has a second, genuinely different axis worth sorting by —
// award size varies real orders of magnitude there in a way citation counts
// or milestone dates don't for the other three stages.
const SORT_OPTIONS: Partial<Record<Stage, SortOption[]>> = {
  investment: [
    { key: "recent", label: "Recent", compare: (a, b) => (a.date < b.date ? 1 : -1) },
    { key: "size", label: "Size", compare: (a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0) },
  ],
};

export function StageColumn({
  stage,
  entries,
  note,
  highlightOrg,
  id,
  onSelectEntry,
}: {
  stage: Stage;
  entries: Entry[];
  note?: StageNote;
  highlightOrg?: string | null;
  id?: string;
  onSelectEntry?: (entry: Entry) => void;
}) {
  const meta = STAGES.find((s) => s.id === stage)!;
  const typeFilters = TYPE_FILTERS[stage];
  const sortOptions = SORT_OPTIONS[stage];
  const bodyRef = useRef<HTMLDivElement>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState(sortOptions?.[0]?.key ?? "");

  const typeOpt = typeFilters.find((f) => f.key === activeType) ?? null;
  const sortCompare = sortOptions?.find((s) => s.key === activeSort)?.compare ?? null;

  // Any active control (org highlight from the institution leaderboard, or
  // this column's own type-filter chip) reorders matches to the top of the
  // scroll rather than just dimming them in place — the point is to see the
  // filtered set without having to scroll to find it.
  const matches = (e: Entry) => (!highlightOrg || e.org === highlightOrg) && (!typeOpt || typeOpt.test(e));
  const hasFilter = Boolean(highlightOrg) || Boolean(typeOpt);

  const display = useMemo(() => {
    const base = sortCompare ? [...entries].sort(sortCompare) : entries;
    if (!hasFilter) return base;
    return [...base.filter(matches), ...base.filter((e) => !matches(e))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, sortCompare, hasFilter, activeType, highlightOrg]);

  function selectType(key: string) {
    setActiveType((prev) => (prev === key ? null : key));
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }
  function selectSort(key: string) {
    setActiveSort(key);
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section id={id} className="stage" style={{ ["--stage" as string]: STAGE_VAR[stage] }}>
      <header className="stage-head">
        <div className="stage-tag"><span className="bar" />{STAGE_NUM[stage]} · {meta.label}</div>
        <h3 className="stage-name">{meta.label}</h3>
        <div className="stage-count">{entries.length} {entries.length === 1 ? "entry" : "entries"}</div>
        <p className="stage-blurb">{meta.blurb}</p>
        <div className="stage-controls">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              className="stage-chip"
              aria-pressed={activeType === f.key}
              onClick={() => selectType(f.key)}
              title={`Show ${f.label.toLowerCase()} entries first`}
            >
              {f.label}
            </button>
          ))}
          {sortOptions && (
            <span className="stage-sort">
              {sortOptions.map((s) => (
                <button
                  key={s.key}
                  className="stage-chip"
                  aria-pressed={activeSort === s.key}
                  onClick={() => selectSort(s.key)}
                  title={`Sort by ${s.label.toLowerCase()}`}
                >
                  {s.label}
                </button>
              ))}
            </span>
          )}
        </div>
      </header>
      {note && <NoteCard note={note} />}
      <div className="stage-body" ref={bodyRef}>
        {display.length === 0
          ? <div className="trend-empty" style={{ padding: "22px 14px", textAlign: "center" }}>no entries for this filter</div>
          : display.map((e) => <Card key={e.id} entry={e} dim={hasFilter && !matches(e)} onSelect={onSelectEntry} />)}
      </div>
    </section>
  );
}
