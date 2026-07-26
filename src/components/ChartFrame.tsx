import { useState, type ReactNode } from "react";

// Shared scaffolding for "every major chart must have a plain-language
// title, a one-sentence takeaway, visible units, a legend when needed, a
// coverage note, and a useful empty state" — one frame instead of each
// dashboard hand-rolling its own header/note/empty-state markup.
export function ChartFrame({
  title,
  takeaway,
  controls,
  legend,
  note,
  empty,
  children,
}: {
  title: ReactNode;
  takeaway?: ReactNode;
  controls?: ReactNode;
  legend?: ReactNode;
  note?: ReactNode;
  empty?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="chart-frame">
      <SectionHeader title={title} takeaway={takeaway} note={note} />
      {controls && <div className="chart-frame-controls">{controls}</div>}
      <div className="chart-frame-body">{empty ?? children}</div>
      {legend && <div className="chart-frame-legend">{legend}</div>}
    </div>
  );
}

// The plain-language title + one-sentence takeaway pattern used above
// every real section — title states the QUESTION or subject, takeaway
// states what the current real data actually shows, so a reader gets an
// answer before they have to read the chart itself.
export function SectionHeader({
  title,
  takeaway,
  note,
}: {
  title: ReactNode;
  takeaway?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="section-header">
      <h3>
        <span>{title}</span>
        {note}
      </h3>
      {takeaway && <div className="panel-takeaway">{takeaway}</div>}
    </div>
  );
}

// A single, full-width, bounded finding sentence — the ONE place per
// dashboard allowed to read as a small "hero" (the Overview leadership
// statement); everywhere else a takeaway is left-aligned prose. Never
// centered content beyond the sentence itself, and never hard-coded —
// always generated from the current real data at the call site.
export function PolicyTakeaway({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warning" }) {
  return (
    <div className={`policy-takeaway${tone === "warning" ? " policy-takeaway-warning" : ""}`} role={tone === "warning" ? "note" : undefined}>
      {children}
    </div>
  );
}

// Verified / reported / uncertain / missing — one small badge, one shared
// meaning everywhere it appears (milestone timelines, adoption records,
// coverage cells). Color is never the only signal — the label text is
// always visible, never color-only.
export type DataQuality = "verified" | "reported" | "uncertain" | "missing";
const QUALITY_LABEL: Record<DataQuality, string> = {
  verified: "Verified",
  reported: "Reported",
  uncertain: "Uncertain",
  missing: "No data",
};
export function DataQualityBadge({ status, label }: { status: DataQuality; label?: string }) {
  return <span className={`quality-badge quality-${status}`}>{label ?? QUALITY_LABEL[status]}</span>;
}

// A real, honest "nothing to show" state — never a blank div, never a
// centered orphan floating in empty space. Left-aligned like every other
// piece of body content per the v5 layout rules.
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="trend-empty empty-state">{children}</div>;
}

// Collapses the long, real Sources & Method prose by default so a reader
// isn't asked to read methodology before the page's own findings — the
// full text is one click away, never deleted or shortened.
export function ExpandableMethods({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="expandable-methods">
      <button className="expandable-methods-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {summary} <span className="expandable-methods-caret">{open ? "▲ Close" : "▼ Open methodology"}</span>
      </button>
      {open && <div className="expandable-methods-body">{children}</div>}
    </div>
  );
}
