import { useEffect, useMemo, useState } from "react";
import type { Entry, Stage } from "../lib/types.ts";
import { countryName } from "../lib/countries.ts";
import { dedupeNews, isNewsEntry, newsCategory, newsFreshnessLabel, type NewsCategory } from "../lib/news.ts";
import { EmptyState } from "./ChartFrame.tsx";

type SortKey = "newest" | "relevance" | "country";
const TRACK_LABEL: Record<Stage, string> = { innovation: "Research", scaling: "Scaling", adoption: "Adoption", investment: "Money" };
const CATEGORIES: NewsCategory[] = ["Policy", "Research", "Scaling", "Adoption", "Funding", "Company", "Security", "International", "News"];

// The full "View all news" surface — every real tracked news-shaped entry
// (provenance:"auto"), filterable and sortable, deduplicated the same way
// the ticker is. Never a raw record dump: still only real news-shaped
// entries, still one row per real event, not per duplicate report.
export function NewsExplorer({
  entries,
  focusCountry,
  onClose,
  onSelectEntry,
}: {
  entries: Entry[];
  focusCountry?: string | null;
  onClose: () => void;
  onSelectEntry: (entry: Entry) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NewsCategory | "all">("all");
  const [country, setCountry] = useState<string | "all">(focusCountry ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups = useMemo(() => dedupeNews(entries.filter(isNewsEntry)), [entries]);

  const availableCountries = useMemo(() => {
    const codes = new Set<string>();
    for (const g of groups) if (g.primary.country) codes.add(g.primary.country);
    return [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  }, [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = groups;
    if (q) rows = rows.filter((g) => g.primary.title.toLowerCase().includes(q) || (g.primary.publisher ?? "").toLowerCase().includes(q));
    if (category !== "all") rows = rows.filter((g) => newsCategory(g.primary) === category);
    if (country !== "all") rows = rows.filter((g) => g.primary.country === country);
    const sorted = [...rows];
    if (sortKey === "newest") sorted.sort((a, b) => (a.primary.date < b.primary.date ? 1 : -1));
    else if (sortKey === "relevance") sorted.sort((a, b) => (b.primary.relevanceScore ?? 0) - (a.primary.relevanceScore ?? 0));
    else if (sortKey === "country" && country !== "all") sorted.sort((a, b) => (a.primary.country === country ? -1 : 1) - (b.primary.country === country ? -1 : 1));
    return sorted;
  }, [groups, query, category, country, sortKey]);

  return (
    <div className="record-explorer-backdrop" onClick={onClose}>
      <div className="record-explorer news-explorer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="All news">
        <div className="record-explorer-head">
          <span className="lbl">Breaking news · {filtered.length} of {groups.length} tracked stories</span>
          <button className="ghost-btn" onClick={onClose}>✕ close (esc)</button>
        </div>
        <div className="record-explorer-controls">
          <input
            className="record-explorer-search"
            type="search"
            placeholder="Search headline or publisher…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search news"
          />
          <select className="country-filter-select" value={category} onChange={(e) => setCategory(e.target.value as NewsCategory | "all")} aria-label="Filter by category">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="country-filter-select" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Filter by country">
            <option value="all">All countries</option>
            {availableCountries.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
          </select>
          <div className="tab-bar">
            <button className="chip" aria-pressed={sortKey === "newest"} onClick={() => setSortKey("newest")}>Newest</button>
            <button className="chip" aria-pressed={sortKey === "relevance"} onClick={() => setSortKey("relevance")}>Relevance</button>
            {country !== "all" && <button className="chip" aria-pressed={sortKey === "country"} onClick={() => setSortKey("country")}>Country relevance</button>}
          </div>
        </div>
        <div className="record-explorer-body">
          {filtered.length === 0 ? (
            <EmptyState>No stories match this search — try widening the filters.</EmptyState>
          ) : (
            <table className="lb news-table">
              <thead>
                <tr>
                  <th>Headline</th>
                  <th>Publisher</th>
                  <th>Time</th>
                  <th>Country</th>
                  <th>Category</th>
                  <th>Track</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.primary.id} className="clickable" onClick={() => onSelectEntry(g.primary)}>
                    <td className="org-name">{g.primary.title}{g.alsoReportedBy.length > 0 && <span className="ticker-also"> +{g.alsoReportedBy.length} sources</span>}</td>
                    <td>{g.primary.publisher ?? "—"}</td>
                    <td className="num">{newsFreshnessLabel(g.primary.date)}</td>
                    <td>{g.primary.country ? countryName(g.primary.country) : "—"}</td>
                    <td>{newsCategory(g.primary)}</td>
                    <td>{TRACK_LABEL[g.primary.stage]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
