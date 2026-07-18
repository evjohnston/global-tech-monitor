// The pipeline stages. Order matters — it's the flow of the monitor.
// Investment sits first conceptually (money precedes research) but we render
// it last as a distinct lens, since its data source and cadence differ.
export type Stage = "innovation" | "scaling" | "adoption" | "investment";

// Geopolitical actor. "other" is the honest catch-all, not a failure state.
export type Actor = "us" | "cn" | "eu" | "other";

// Where an entry came from, and — crucially — whether it's live or curated.
// This is the provenance layer. The prototype conflated these; the real
// version keeps them explicit so the UI can never imply a seeded milestone
// is a live feed.
export type Provenance = "live" | "seeded";

export type SourceKind =
  | "arxiv" // research preprint (innovation)
  | "patent" // patent filing (innovation)
  | "milestone" // hardware / scaling announcement (scaling)
  | "deployment" // commercial or govt adoption (adoption)
  | "grant"; // research funding award (investment)

export interface Entry {
  id: string; // stable, dedupe key
  stage: Stage;
  actor: Actor;
  provenance: Provenance;
  source: SourceKind;
  title: string;
  org: string; // affiliation, lab, or vendor
  date: string; // ISO date (YYYY-MM-DD) or YYYY-MM for coarse milestones
  url: string;
  // How the actor was decided, so misclassification is auditable rather
  // than silent. Empty for hand-curated entries where actor is known.
  actorEvidence?: string;
  // Optional signal fields. citations powers the "high-impact" weighting
  // (ASPI uses top-10% most-cited); amountUsd powers the funding view.
  citations?: number;
  amountUsd?: number;
}

// One dated observation of actor share, appended each nightly run. This is
// how trend-over-time works: we stop overwriting and start accumulating.
export interface TrendPoint {
  date: string; // ISO date of the fetch run
  counts: Record<Actor, number>; // innovation-stage works by actor that run
}

// A dated analyst note attached to a pipeline stage — the "so what" layer.
// Written by a human, held in data/notes.ts. This is what a 10-minute reader
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
  technology: string; // "quantum-computing"
  generatedAt: string; // ISO timestamp of the last fetch run
  entries: Entry[];
  trend: TrendPoint[]; // accumulated actor-share history
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
    blurb: "Engineering the qubit count. Hardware milestones and fab capacity.",
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

export const ACTORS: { id: Actor; label: string; short: string }[] = [
  { id: "us", label: "United States", short: "US" },
  { id: "cn", label: "China", short: "CN" },
  { id: "eu", label: "Europe", short: "EU" },
  { id: "other", label: "Other", short: "—" },
];
