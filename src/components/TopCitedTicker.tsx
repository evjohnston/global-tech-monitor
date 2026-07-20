import type { Entry } from "../lib/types.ts";
import { countryName } from "../lib/countries.ts";

// The most-cited real papers per year, last 3 complete calendar years —
// grouped and ordered by year (most recent complete year first), each
// year's group internally ranked by real citation count. Deliberately
// per-year rather than one pool resorted by raw citation count: citations
// accrue over time, so an undifferentiated top-N would just be dominated
// by the oldest year (see fetchTopCitedByYear in openalex.ts, which fetches
// the real top-N per year for exactly this reason — this component reads
// what's already in `entries`, it doesn't recompute the ranking itself,
// since a client-side resort would reintroduce the same year-bias problem
// the dedicated per-year fetch exists to avoid).
export function TopCitedTicker({ entries, years, onSelect }: { entries: Entry[]; years: number[]; onSelect?: (entry: Entry) => void }) {
  const byYear = new Map<number, Entry[]>();
  for (const e of entries) {
    if (e.source !== "paper" || !e.citations || !e.date) continue;
    const year = Number(e.date.slice(0, 4));
    if (!years.includes(year)) continue;
    const list = byYear.get(year) ?? [];
    list.push(e);
    byYear.set(year, list);
  }

  const ranked = years
    .slice()
    .sort((a, b) => b - a)
    .flatMap((year) => (byYear.get(year) ?? []).sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0)));

  if (ranked.length === 0) return null;

  const cards = (key: "a" | "b") =>
    ranked.map((e, i) => (
      <button className="cited-card" key={`${key}-${e.id}-${i}`} onClick={() => onSelect?.(e)} title={e.title}>
        <span className="cited-card-tag">{e.date.slice(0, 4)} · {e.citations} cit.</span>
        <span className="cited-card-title">{e.title}</span>
        <span className="cited-card-meta">{e.org}{e.country ? ` · ${countryName(e.country)}` : ""}</span>
      </button>
    ));

  return (
    <div className="wrap cited-ticker-wrap">
      <div className="cited-ticker-label">Most cited <span className="drop">{years.slice().sort((a, b) => b - a).join("/")}</span></div>
      <div className="cited-track-wrap">
        <div className="cited-track" style={{ animationDuration: `${Math.max(40, ranked.length * 4)}s` }}>
          {cards("a")}
          {cards("b")}
        </div>
      </div>
    </div>
  );
}
