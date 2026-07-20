import { useEffect } from "react";
import type { Entry } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { fmtUsd } from "../lib/format.ts";

// EntryModal is one shared display for every source (OpenAlex/EPO/NSF/RSS
// now, more as verticals grow — see CLAUDE.md). Per-source label wording
// lives here as a lookup, not a branch in the JSX, so a new source with its
// own vocabulary is a table entry rather than another ?:. Same pattern as
// StageColumn.tsx's STAGE_LABEL.
const AUTHOR_LABEL: Partial<Record<Entry["source"], string>> = { patent: "Inventors" };
const VENUE_LABEL: Partial<Record<Entry["source"], string>> = { grant: "Program" };

// All content here is real data already carried on the Entry — abstract/
// authors/venue/classification come straight from the same API response
// each source already fetches (see src/lib/sources/*), never a generated
// summary. Escape/backdrop-click closes, same pattern as WorldMap's
// fullscreen overlay.
export function EntryModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta = STAGES.find((s) => s.id === entry.stage)!;
  const color = countryColor(entry.country);
  const amt = entry.amountUsd ? fmtUsd(entry.amountUsd) : null;

  return (
    <div className="entry-modal-backdrop" onClick={onClose}>
      <div className="entry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="entry-modal-head">
          <span className="entry-modal-badge" style={{ background: color }} title={entry.countryEvidence || undefined}>
            {countryName(entry.country)}
          </span>
          <span className="entry-modal-stage">{meta.label}</span>
          <button className="entry-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <h3 className="entry-modal-title">{entry.title}</h3>

        <div className="entry-modal-meta">
          {entry.date && <span className="num">{entry.date}</span>}
          <span className="entry-modal-src">{entry.source}</span>
          {amt && <span className="entry-modal-amt">{amt}</span>}
          {entry.provenance === "seeded" && <span className="seeded">seeded</span>}
          {entry.provenance === "auto" && <span className="seeded auto">auto-classified</span>}
        </div>

        {entry.org && <div className="entry-modal-org">{entry.org}</div>}

        {(entry.venue || entry.classification || entry.citations != null) && (
          <div className="entry-modal-facts">
            {entry.venue && (
              <div><span className="lbl">{VENUE_LABEL[entry.source] ?? "Venue"}</span>{entry.venue}</div>
            )}
            {entry.classification && <div><span className="lbl">CPC</span>{entry.classification}</div>}
            {entry.citations != null && <div><span className="lbl">Citations</span>{entry.citations}</div>}
          </div>
        )}

        {entry.authors && entry.authors.length > 0 && (
          <div className="entry-modal-authors">
            <span className="lbl">{AUTHOR_LABEL[entry.source] ?? "Authors"}</span>
            {entry.authors.join(", ")}
          </div>
        )}

        {entry.abstract && <p className="entry-modal-abstract">{entry.abstract}</p>}

        <a className="entry-modal-link" href={entry.url} target="_blank" rel="noopener noreferrer">
          View source ↗
        </a>
      </div>
    </div>
  );
}
