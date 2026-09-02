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
  | "news" // funding/investment news, auto-classified (investment) — Google News RSS, keyword-guessed
  | "statistic" // official government/international-org statistic (innovation) — OECD, real reported data, no institution
  | "funding-round"; // private capital raise (investment) — hand-verified seed data, NOT public funding; kept out of fundingByCountry/periodFunding's NSF-only sum, see aggregate.ts

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
  // Real outlet name for provenance:"auto" (RSS/Google News) entries — the
  // trade-press feed or outlet that reported the story, kept in its OWN
  // field rather than in `org` (which used to default to the feed name;
  // fixed 2026-07-25, see rss.ts, since that let a publisher outrank every
  // real scaling org/adopter on the leaderboards). Undefined for
  // hand-verified/live entries, which have no "publisher" concept.
  publisher?: string;
  // How the country was decided, so misclassification is auditable rather
  // than silent. Empty for hand-curated entries where it's simply known.
  countryEvidence?: string;
  // Optional signal fields. citations powers the "high-impact" weighting
  // (ASPI uses top-10% most-cited); amountUsd powers the funding view.
  citations?: number;
  amountUsd?: number;
  // Detail-popup enrichment — all pulled from the same response each source
  // already fetches, never a second request. abstract: OpenAlex paper
  // abstract (reconstructed from its inverted-index form), EPO patent
  // abstract, NSF project abstract, or the RSS/Google News item description.
  // authors: OpenAlex paper authors or EPO patent inventors. venue: OpenAlex
  // journal/source name or NSF's specific program name. classification: EPO
  // CPC code(s) for this filing, e.g. "G06N10/20".
  abstract?: string;
  authors?: string[];
  venue?: string;
  classification?: string;
  // ISO timestamp of when THIS app first ingested this entry — distinct
  // from `date` (when the real-world thing happened). Stamped once, at
  // first sight, and preserved across every later merge (see fetch-data.ts)
  // — it must never get overwritten by a later run's timestamp just because
  // the same entry was fetched again. Absent on entries ingested before this
  // field existed; backfilled once, not reconstructable for those.
  ingestedAt?: string;
  // Canonical entity id for `org`, e.g. "IBM Quantum" / "IBM Research -
  // Zurich" / "International Business Machines Corporation" all resolve to
  // the same id — see entityResolution.ts. `org` itself is left as the raw
  // string a source actually returned; this is only a grouping key, so
  // leaderboards/filters count the real org once instead of splitting it
  // across case/legal-suffix variants.
  orgId?: string;
  // Distinct, sorted real institution country codes across a work's
  // authorships, when 2+ are resolvable — a genuine cross-border
  // co-authorship, not an inference (see mapWork() in
  // src/lib/sources/openalex.ts, which already collects every authorship's
  // country before collapsing to the single modal `country` above; this
  // just keeps the rest instead of discarding it). Omitted, never an empty
  // array, when a work is domestic-only or has no resolvable institution
  // data — same "omit rather than fabricate" convention as every other
  // optional field here. Only ever populated for OpenAlex-sourced entries.
  collaboratingCountries?: string[];
  // Real status within the adoption journey, when the source text actually
  // supports it — "announced" (unveiled/plans to), "pilot" (trial/test
  // deployment), "procurement" (ordered/signed/awarded a contract),
  // "deployed" (installed/went live), "operating" (in production/ongoing
  // use). Only ever set for stage:"adoption" entries; omitted rather than
  // guessed when the text doesn't clearly support one of the five — same
  // "omit rather than fabricate" convention as every other optional field
  // here. Two tiers, same honesty split as everything else: hand-assigned
  // for seed.ts entries (re-reading the same source text already verified
  // when the entry was added), keyword-classified for RSS entries (see
  // classifyDeploymentStatus in sources/rss.ts) — the latter inherits
  // provenance:"auto"'s weaker reliability, it doesn't get its own tier.
  deploymentStatus?: "announced" | "pilot" | "procurement" | "deployed" | "operating";
  // 0-1 confidence that this entry genuinely belongs in its vertical —
  // currently a disclosed, coarse heuristic by source kind (see
  // sourceMeta.ts's RELEVANCE_SCORE_BY_SOURCE), not a per-entry ML score.
  // Real per-entry scoring (an LLM relevance pass) was deliberately deferred
  // — regex/keyword tightening handled the concrete false positives found
  // by hand (2026-07-20) well enough for NSF/RSS text; this field exists so
  // a future per-entry score has somewhere to land without a schema change,
  // and so the UI can show *some* honest confidence signal today rather
  // than none.
  relevanceScore?: number;
}

// Per-source freshness/coverage facts — one row per real upstream source,
// not per vertical (the sources are the same shape across verticals; only
// `lastSuccessfulPull` and whether a source is used at all can differ).
// `pollCadence`/`structuralLag`/`coverageGaps` are facts about the source
// itself, not computed; `lastSuccessfulPull` is the one dynamic field,
// updated only when that source's fetch actually succeeds this run — a
// transient failure carries the previous value forward rather than erasing
// when this source last really worked (see fetch-data.ts).
export interface SourceMeta {
  sourceName: string;
  lastSuccessfulPull: string | null; // ISO timestamp, null if never succeeded
  pollCadence: string;
  structuralLag: string;
  coverageGaps: string; // "" if none material
}

// One dated observation of country share, appended each nightly run. This is
// how trend-over-time works: we stop overwriting and start accumulating.
// Keyed by ISO alpha-2 code — open-ended, not a fixed bucket set, so it
// naturally covers however many countries a given day's data touched.
export interface TrendPoint {
  date: string; // ISO date of the fetch run
  counts: Record<string, number>; // innovation-stage works by country, rolling ~30d OpenAlex window that run
  // Added 2026-07-20 — trailing-21d snapshots (as of `date`) of the same
  // shape periodCounts()/periodFunding() compute live, so a real day-over-
  // day trend exists for stage volume and disclosed funding, not just
  // innovation-country share. Optional because every point recorded before
  // this date lacks them — treat their absence as "no data that day," not
  // zero, when reading history (see aggregate.ts's loadHistory()).
  stageCounts?: Record<Stage, number>;
  fundingUsd?: number;
  totalEntries?: number; // cumulative corpus size as of this date (monotonic by nature — real, not a rate)
  // How many works the run that produced this point could SEE — OA_N x
  // OA_PAGES in scripts/fetch-data.ts at the time. Added 2026-09-02, when
  // that ceiling went from 600 to 10,000 to actually cover the AI and
  // biotech corpora (they were being sampled at ~6%). Points recorded at
  // different ceilings are counting to different limits and must never
  // share a chart line — a 600-cap point next to a 10,000-cap one reads as
  // 20x growth that didn't happen, the same class of error that made
  // backfill-trend's reconstructions wrong. Absent on every point recorded
  // before this field existed, which is itself the signal that it predates
  // the change. Nothing is deleted for this: loadHistory() in aggregate.ts
  // filters to one comparable series at read time, so the raw record stays
  // in the file and a future ceiling change self-heals.
  windowCap?: number;
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

// A real-market snapshot for one hand-picked public company exposed to this
// vertical (see verticals.ts's `tickers` field) — market cap + latest price/
// day-change from the Massive REST API (api.massive.com, /v3/reference/
// tickers/{ticker} + /v2/snapshot/.../tickers/{ticker}). Deliberately NOT an
// Entry: it's a standing fact about a company, not a discrete dated event,
// and it sits outside the 4-stage pipeline as its own panel (see CLAUDE.md
// if this section still describes it that way, or App.tsx's company panel).
export interface CompanySnapshot {
  symbol: string; // exchange ticker, e.g. "NVDA"
  name: string; // company name as Massive returns it
  marketCapUsd?: number;
  price?: number;
  changePercent?: number; // today's % change, real from Massive's snapshot endpoint
  asOf: string; // ISO timestamp this snapshot was fetched
  url: string; // company homepage, from Massive's reference data
}

// One fiscal year's total disclosed corporate R&D spend, summed across a
// vertical's tickers (see verticals.ts), sourced from real SEC EDGAR XBRL
// filings (src/lib/sources/secEdgar.ts) — no key needed. Deliberately kept
// separate from Entry/fundingByCountry's amountUsd aggregate: that number is
// specifically PUBLIC research funding (NSF), matching STAGES' own
// "Where governments are placing money" framing — corporate R&D is private
// capital, a different thing, and mixing the two into one total would
// misrepresent both. `companies` lists which tickers actually contributed
// (a company with no clean XBRL R&D concept, e.g. Amazon folds R&D into a
// broader "technology and infrastructure" line with no standalone tag, is
// skipped rather than force-fit — see secEdgar.ts).
export interface RdSpendPoint {
  fiscalYear: number; // calendar year of the fiscal-period end date
  totalUsd: number;
  // `source` distinguishes SEC EDGAR's live XBRL pull from a hand-imported
  // S&P Capital IQ export (data/capiq/rd-spend.ts, scripts/import-capiq-rd-
  // export.ts) — added for foreign 20-F filers (Samsung, SoftBank, Tencent,
  // NTT, Fujitsu, etc.) that SEC EDGAR structurally can't cover, since they
  // don't file 10-Ks. CapIQ entries are a manual, periodic import, not a
  // live fetch — re-run the import script after a fresh export if this
  // data goes stale. See CLAUDE.md.
  companies: { symbol: string; amountUsd: number; source: "sec" | "capiq" }[];
}

// One real VC/growth financing round, from S&P Capital IQ's Transactions
// screener (data/capiq/vc-funding.ts, scripts/import-capiq-transactions.ts)
// — a much deeper source than the ~15-17 hand-curated `funding-round`
// seed entries per vertical, but a manual/periodic import like rdSpend
// above, not a live fetch. `type` and `status` are CapIQ's own real
// labels, kept as-is rather than reinterpreted (e.g. "ROF - Venture -
// Series A", "Completed"). `amountUsd` is null when CapIQ itself has no
// disclosed figure ("NA" in the export) — an undisclosed round is real
// information (the deal happened), not a zero.
export interface VcDeal {
  dealId: string; // CapIQ's SPTR_MI_TRANSACTION_ID, or PitchBook's own real
  // dealid — the real dedup key when the same vertical gets imported from
  // more than one tag search (e.g. "Machine Learning" merged into
  // "artificial-intelligence") and the same real transaction shows up in
  // both exports.
  date: string; // ISO, from the export's announcement date
  type: string;
  status: string;
  amountUsd: number | null;
  investors: string[];
  // Which real provider this deal came from — undefined means CapIQ (the
  // only provider when this field was added; every CapIQ-imported deal
  // predates it, so absence defaults to that rather than every existing
  // committed row needing a hand-edit). PitchBook-imported deals always
  // set this explicitly. Same provenance-auditing principle as
  // RdSpendPoint.companies[].source — a company appearing in both
  // providers' exports is a real, disclosed limitation (see
  // scripts/import-pitchbook.ts), not silently merged into one figure.
  source?: "capiq" | "pitchbook";
}

// One company's real, entity-consolidated VC funding history within a
// vertical — canonicalizeOrg() (entityResolution.ts) merges CapIQ's
// separate legal-entity-name rows (e.g. "OpenAI, L.L.C." / "OpenAI OpCo,
// LLC" / "The OpenAI Deployment Company, LLC") into one real company.
export interface VcCompanyFunding {
  orgId: string;
  name: string;
  totalRaisedUsd: number; // sum of deals with a disclosed amountUsd only
  dealCount: number; // includes undisclosed-amount deals — a real count of activity, not just disclosed dollars
  deals: VcDeal[];
}

// The shape of the committed data file the app reads at load.
export interface DataFile {
  technology: string; // vertical id — see src/lib/verticals.ts, e.g. "quantum-computing"
  generatedAt: string; // ISO timestamp of the last fetch run
  entries: Entry[];
  trend: TrendPoint[]; // accumulated country-share history
  notes: StageNote[]; // analyst interpretation per stage
  sourceMeta: SourceMeta[]; // per-source freshness/cadence/lag/coverage facts
  // Optional: absent entirely on data files built before this existed, or
  // when MASSIVE_KEY isn't set (soft-fails like every other source here).
  companies?: CompanySnapshot[];
  // Optional: absent when no ticker in this vertical has a usable SEC XBRL
  // R&D concept, or on data files built before this existed.
  rdSpend?: RdSpendPoint[];
  // Optional: absent until a CapIQ Transactions export has been imported
  // for this vertical. See VcCompanyFunding above.
  vcFunding?: VcCompanyFunding[];
}

export const STAGES: { id: Stage; label: string; blurb: string }[] = [
  {
    id: "innovation",
    label: "Innovation",
    blurb: "Research and invention. Papers and patents — or, for a human-capital vertical, the researcher base itself. What is being discovered, and by how many people.",
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

