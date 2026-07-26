import type { Entry } from "../lib/types.ts";
import { countryName } from "../lib/countries.ts";
import { compareSentences } from "../lib/compareSentence.ts";

const MAX_COMPARE = 4;

// Persistent 2-4 country selection — highlights those countries across
// every chart that takes an `emphasize` prop rather than hard-filtering the
// page (that's what the existing single-country filter chips already do).
// Comparison sentences are fixed rule templates (compareSentence.ts), not
// free text, so every claim here is traceable back to a real aggregate.
export function CompareRibbon({
  entries,
  available,
  selected,
  onToggle,
}: {
  entries: Entry[];
  available: string[];
  selected: string[];
  onToggle: (country: string) => void;
}) {
  const sentences = compareSentences(entries, selected);
  return (
    <div className="panel">
      <h3>
        Compare countries <span className="drop">select 2-4 · stays active across every chart below</span>
      </h3>
      <div className="tab-bar">
        {available.map((c) => (
          <button
            key={c}
            className="chip"
            aria-pressed={selected.includes(c)}
            disabled={!selected.includes(c) && selected.length >= MAX_COMPARE}
            onClick={() => onToggle(c)}
          >
            {countryName(c)}
          </button>
        ))}
      </div>
      {selected.length === 1 && <div className="trend-note">Select at least one more country to generate a comparison.</div>}
      {sentences.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {sentences.map((s, i) => (
            <div key={i} className="trend-note" style={{ marginBottom: 4 }}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}
