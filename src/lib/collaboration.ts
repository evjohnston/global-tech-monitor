import type { Entry } from "./types.ts";

export interface CollaborationEdge {
  a: string; // alphabetically first of the pair — canonical, undirected
  b: string;
  count: number; // real papers whose authors span both countries
}

// Derived fresh from entries[] every time, same posture as countByCountry/
// orgLeaderboard — never a separately-accumulated running counter. This is
// what keeps it honest: entries[] is already deduped by real work id via
// the existing merge in fetch-data.ts, so a paper re-seen across nightly
// runs contributes its edge exactly once, automatically, with no new dedup
// logic needed here. A work naming 3+ countries contributes one edge per
// pair (standard bibliometric practice, not inflated — a paper with
// authors in US/CN/DE is a real 3-way collaboration, not 3 unrelated ones).
export function collaborationEdges(entries: Entry[]): CollaborationEdge[] {
  const tally = new Map<string, number>();
  for (const e of entries) {
    const countries = e.collaboratingCountries;
    if (!countries || countries.length < 2) continue;
    for (let i = 0; i < countries.length; i++) {
      for (let j = i + 1; j < countries.length; j++) {
        const key = `${countries[i]}|${countries[j]}`;
        tally.set(key, (tally.get(key) ?? 0) + 1);
      }
    }
  }
  return [...tally.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split("|");
      return { a, b, count };
    })
    .sort((x, y) => y.count - x.count);
}

// Sum of edge weight touching each country — real ranking off real
// activity, not a hardcoded list of "usual suspects."
export function collaborationTotalsByCountry(edges: CollaborationEdge[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of edges) {
    totals[e.a] = (totals[e.a] ?? 0) + e.count;
    totals[e.b] = (totals[e.b] ?? 0) + e.count;
  }
  return totals;
}

// The real papers behind one edge — feeds the metadata drawer's "view
// underlying records" for a collaboration pair, and the collaboration
// network's edge-hover/click drill-down.
export function entriesForCollaboration(entries: Entry[], a: string, b: string): Entry[] {
  return entries.filter((e) => e.collaboratingCountries?.includes(a) && e.collaboratingCountries?.includes(b));
}

// Top partners for one country, by edge weight — feeds the "5 strongest
// partners" side list on hover.
export function topPartnersFor(edges: CollaborationEdge[], country: string, n = 5): { partner: string; count: number }[] {
  return edges
    .filter((e) => e.a === country || e.b === country)
    .map((e) => ({ partner: e.a === country ? e.b : e.a, count: e.count }))
    .sort((x, y) => y.count - x.count)
    .slice(0, n);
}
