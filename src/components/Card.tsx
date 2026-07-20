import type { Entry } from "../lib/types.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { fmtUsd } from "../lib/format.ts";

export function Card({ entry, dim, onSelect }: { entry: Entry; dim?: boolean; onSelect?: (entry: Entry) => void }) {
  const amt = entry.amountUsd ? fmtUsd(entry.amountUsd) : null;
  const color = countryColor(entry.country);
  return (
    <div
      className={`ecard${dim ? " dim" : ""}${onSelect ? " clickable" : ""}`}
      style={{ ["--acc" as string]: color }}
      onClick={onSelect ? () => onSelect(entry) : undefined}
      title={onSelect ? "Click for details" : undefined}
    >
      <div className="ecard-meta">
        <span
          className="ecard-badge"
          style={{ background: color }}
          title={entry.countryEvidence || undefined}
        >
          {countryName(entry.country)}
        </span>
        {entry.date && <span>{entry.date}</span>}
        <span className="ecard-src">{entry.source}</span>
        {amt && <span className="ecard-amt">{amt}</span>}
        {entry.provenance === "seeded" && <span className="seeded">seeded</span>}
        {entry.provenance === "auto" && <span className="seeded auto">auto-classified</span>}
      </div>
      <div className="ecard-title">{entry.title}</div>
      {entry.org && <div className="ecard-org">{entry.org}</div>}
    </div>
  );
}
