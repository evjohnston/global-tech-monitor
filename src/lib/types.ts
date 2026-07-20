// The pipeline stages. Order matters — it's the flow of the monitor.
// Investment sits first conceptually (money precedes research) but we render
// it last as a distinct lens, since its data source and cadence differ.
export type Stage = "innovation" | "scaling" | "adoption" | "investment";

// Where an entry came from, and — crucially — how much to trust it.
// "live" = institution/awardee-attributed real data (OpenAlex, NSF, EPO).
// "seeded" = hand-verified by a human, fetched and confirmed against its
// source before being added (data/<vertical>/seed.ts).
// "auto" = live-fetched (RSS) but machine-classified — stage and country are
// a keyword guess, not a verified fact. Weakest tier; the UI must say so.
export type Provenance = "live" | "seeded" | "auto";

export type SourceKind =
  | "paper" // published research, journal/conference (innovation) — real institution data
  | "arxiv" // research preprint, arXiv fallback only (innovation) — rarely has institution data
  | "patent" // patent filing (innovation)
  | "milestone" // hardware / scaling announcement (scaling)
  | "deployment" // commercial or govt adoption (adoption)
  | "grant" // research funding award (investment) — NSF, real awardee data
  | "news"; // funding/investment news, auto-classified (investment) — Google News RSS, keyword-guessed

export interface Entry {
  id: string; // stable, dedupe key
  stage: Stage;
  // ISO 3166-1 alpha-2 code for the country the institution/awardee/filer is
  // physically located in — null when a source genuinely gives us nothing
  // to go on. Every real country gets logged as itself; nothing is bucketed
  // into a catch-all "other." See src/lib/countries.ts for display helpers.
  country: string | null;
  provenance: Provenance;
  source: SourceKind;
  title: string;
  org: string; // affiliation, lab, or vendor
  date: string; // ISO date (YYYY-MM-DD) or YYYY-MM for coarse milestones
  url: string;
  // How the country was decided, so misclassification is auditable rather
  // than silent. Empty for hand-curated entries where it's simply known.
  countryEvidence?: string;
  // Optional signal fields. citations powers the "high-impact" weighting
  // (ASPI uses top-10% most-cited); amountUsd powers the funding view.
  citations?: number;
  amountUsd?: number;
}

// One dated observation of country share, appended each nightly run. This is
// how trend-over-time works: we stop overwriting and start accumulating.
// Keyed by ISO alpha-2 code — open-ended, not a fixed bucket set, so it
// naturally covers however many countries a given day's data touched.
export interface TrendPoint {
  date: string; // ISO date of the fetch run
  counts: Record<string, number>; // innovation-stage works by country that run
}

// A dated analyst note attached to a pipeline stage — the "so what" layer.
// Written by a human, held in data/<vertical>/notes.ts. This is what a 10-minute reader
// gets before the raw feed.
export interface StageNote {
  stage: Stage;
  date: string; // ISO date the note was written
  author: string;
  headline: string; // one line, the takeaway
  body: string; // 2-4 sentences of interpretation
}

// The shape of the committed data file the app reads at load.
export interface DataFile {
  technology: string; // vertical id — see src/lib/verticals.ts, e.g. "quantum-computing"
  generatedAt: string; // ISO timestamp of the last fetch run
  entries: Entry[];
  trend: TrendPoint[]; // accumulated country-share history
  notes: StageNote[]; // analyst interpretation per stage
}

export const STAGES: { id: Stage; label: string; blurb: string }[] = [
  {
    id: "innovation",
    label: "Innovation",
    blurb: "Research and invention. Papers and patents. What is being discovered.",
  },
  {
    id: "scaling",
    label: "Production / scaling",
    blurb: "Engineering to scale. Hardware milestones and capacity.",
  },
  {
    id: "adoption",
    label: "Adoption",
    blurb: "Use and procurement. Who is actually running it.",
  },
  {
    id: "investment",
    label: "Investment",
    blurb: "Public research funding. Where governments are placing money.",
  },
];

