import { useState, type ReactNode } from "react";

// A small, consistent "Data & method" affordance for a chart's header —
// "no aggregate without a route to its records" extends to method too: a
// reader shouldn't have to scroll to the footer to find out what a chart
// counts, excludes, or how current it is. Reuses each chart's own already-
// written caveat text (passed in as children) rather than inventing new
// copy — this is a presentation control, not a new content-writing pass.
export function MethodNote({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="method-note">
      <button
        className="method-note-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Data and method for this chart"
        title="Data and method"
      >
        ⓘ
      </button>
      {open && <div className="method-note-panel" role="note">{children}</div>}
    </span>
  );
}
