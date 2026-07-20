import type { Provenance, SourceKind } from "./types.ts";

// Coarse, disclosed relevance heuristic by source kind + provenance — not a
// per-entry ML score. Hand-verified seed entries are always 1.0 (a human
// checked the source URL). Everything else is scored by how much a real
// text/classification check backs its topical relevance: EPO's CPC code and
// NSF's now-added title/abstract relevance gate (2026-07-20) are the
// strongest non-human signals; OpenAlex's Topic/Subfield filter has no
// secondary text check and demonstrably lets real noise through (confirmed
// by hand — a work titled "Gamers: Magic The Gathering Tournament" passed
// the AI vertical's filter), so it scores lower despite being a "live"
// provenance entry. Revisit these numbers if a real per-entry score (an
// LLM relevance pass) ever replaces this — that was deliberately deferred,
// not built, when this field was added.
const SCORE_BY_SOURCE: Partial<Record<SourceKind, number>> = {
  patent: 0.85,
  grant: 0.85,
  milestone: 0.75,
  deployment: 0.75,
  news: 0.7,
  arxiv: 0.65,
  paper: 0.6,
};

export function relevanceScoreFor(source: SourceKind, provenance: Provenance): number {
  if (provenance === "seeded") return 1.0;
  return SCORE_BY_SOURCE[source] ?? 0.7;
}
