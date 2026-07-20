import type { Entry } from "../lib/types.ts";
import { countryColor, countryName } from "../lib/countries.ts";

// The most-cited real papers of the last 5 years, ranked flat by real
// citation count — reads what fetchTopCitedPages (openalex.ts) already
// fetched into `entries`, it doesn't recompute the ranking. No per-year
// grouping (an earlier version fetched top-N PER year specifically to
// stop older years from dominating a flat ranking on accumulated
// citations — removed 2026-07-20 at explicit request: this is a flat
// most-cited list, and citation counts naturally favor older work, same
// as every other "most cited" ranking).
export function TopCitedTicker({ entries, limit = 250, onSelect }: { entries: Entry[]; limit?: number; onSelect?: (entry: Entry) => void }) {
  const ranked = entries
    .filter((e) => e.source === "paper" && e.citations)
    .sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0))
    .slice(0, limit);

  if (ranked.length === 0) return null;

  const cards = (key: "a" | "b") =>
    ranked.map((e, i) => (
      <button className="cited-card" key={`${key}-${e.id}-${i}`} onClick={() => onSelect?.(e)} title={e.title}>
        <span className="cited-card-tag">{e.date.slice(0, 4)} · {e.citations} cit.</span>
        <span className="cited-card-title">{e.title}</span>
        <span className="cited-card-meta">
          <span className="cited-card-badge" style={{ background: countryColor(e.country) }}>{countryName(e.country)}</span>
          <span className="cited-card-org">{e.org}</span>
        </span>
      </button>
    ));

  return (
    <div className="cited-ticker-wrap">
      <div className="cited-ticker-label">Most cited <span className="drop">last 5 years</span></div>
      <div className="cited-track-wrap">
        <div className="cited-track" style={{ animationDuration: `${Math.max(40, ranked.length * 4)}s` }}>
          {cards("a")}
          {cards("b")}
        </div>
      </div>
    </div>
  );
}
