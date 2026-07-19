import type { Entry } from "../lib/types.ts";
import { countryColor, countryName } from "../lib/countries.ts";

function fmtAmt(n?: number): string | null {
  if (!n) return null;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

export function Card({ entry, dim }: { entry: Entry; dim?: boolean }) {
  const amt = fmtAmt(entry.amountUsd);
  const color = countryColor(entry.country);
  return (
    <div className={`ecard${dim ? " dim" : ""}`} style={{ ["--acc" as string]: color }}>
      {entry.provenance === "seeded" && <span className="seeded">seeded</span>}
      {entry.provenance === "auto" && <span className="seeded auto">auto-classified</span>}
      <div className="ecard-meta">
        <span
          className="ecard-badge"
          style={{ background: color }}
          title={[entry.country ? countryName(entry.country) : "Unknown country", entry.countryEvidence].filter(Boolean).join(" — ")}
        >
          {entry.country ?? "—"}
        </span>
        {entry.date && <span>{entry.date}</span>}
        <span className="ecard-src">{entry.source}</span>
        {amt && <span className="ecard-amt">{amt}</span>}
      </div>
      <div className="ecard-title">
        <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}</a>
      </div>
      {entry.org && <div className="ecard-org">{entry.org}</div>}
    </div>
  );
}
