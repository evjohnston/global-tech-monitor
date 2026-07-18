import type { Entry } from "../lib/types.ts";

const ACTOR_VAR: Record<Entry["actor"], string> = {
  us: "var(--us)", cn: "var(--cn)", eu: "var(--eu)", other: "var(--other)",
};
const ACTOR_SHORT: Record<Entry["actor"], string> = { us: "US", cn: "CN", eu: "EU", other: "—" };

function fmtAmt(n?: number): string | null {
  if (!n) return null;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

export function Card({ entry }: { entry: Entry }) {
  const amt = fmtAmt(entry.amountUsd);
  return (
    <div className="ecard" style={{ ["--acc" as string]: ACTOR_VAR[entry.actor] }}>
      {entry.provenance === "seeded" && <span className="seeded">seeded</span>}
      <div className="ecard-meta">
        <span className="ecard-badge" style={{ background: ACTOR_VAR[entry.actor] }}>
          {ACTOR_SHORT[entry.actor]}
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
