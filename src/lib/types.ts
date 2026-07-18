// The three pipeline stages. Order matters — it's the flow of the monitor.
export type Stage = "innovation" | "scaling" | "adoption";

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
  | "deployment"; // commercial or govt adoption (adoption)

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
}

// The shape of the committed data file the app reads at load.
export interface DataFile {
  technology: string; // "quantum-computing"
  generatedAt: string; // ISO timestamp of the last fetch run
  entries: Entry[];
}

export const STAGES: { id: Stage; label: string; blurb: string }[] = [
  {
    id: "innovation",
    label: "Innovation",
    blurb: "Research and invention. What is being discovered.",
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
];

export const ACTORS: { id: Actor; label: string; short: string }[] = [
  { id: "us", label: "United States", short: "US" },
  { id: "cn", label: "China", short: "CN" },
  { id: "eu", label: "Europe", short: "EU" },
  { id: "other", label: "Other", short: "—" },
];
