import type { Entry } from "../lib/types.ts";

const ACTOR_COLOR: Record<Entry["actor"], string> = {
  us: "var(--slate-deep)",
  cn: "var(--hoover-red)",
  eu: "var(--warm-gray)",
  other: "var(--silver)",
};

const ACTOR_SHORT: Record<Entry["actor"], string> = {
  us: "US", cn: "CN", eu: "EU", other: "—",
};

export function Card({ entry }: { entry: Entry }) {
  return (
    <div className="card" style={{ ["--actor-color" as string]: ACTOR_COLOR[entry.actor] }}>
      {entry.provenance === "seeded" && <span className="seeded-flag">seeded</span>}
      <div className="card-meta">
        <span className="badge">{ACTOR_SHORT[entry.actor]}</span>
        <span>{entry.date}</span>
        <span className="card-src">{entry.source}</span>
      </div>
      <div className="card-title">
        <a href={entry.url} target="_blank" rel="noopener noreferrer">
          {entry.title}
        </a>
      </div>
      {entry.org && <div className="card-org">{entry.org}</div>}
    </div>
  );
}
