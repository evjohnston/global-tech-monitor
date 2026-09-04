import type { SourceMeta } from "./types.ts";

// One entry per real upstream source (not per vertical — the sources are
// the same shape everywhere; only which ones are configured/succeed can
// differ). `key` is the stable id fetch-data.ts reports success/failure
// against; `cadence`/`lag`/`gaps` are facts about the source, not computed.
const SOURCE_TEMPLATE: { key: string; sourceName: string; pollCadence: string; structuralLag: string; coverageGaps: string }[] = [
  {
    key: "openalex",
    sourceName: "OpenAlex (papers)",
    pollCadence: "every 3 hours (GitHub Actions cron) — the browser never fetches this source itself, it only reads the committed data file",
    structuralLag: "journal-publication lag behind an arXiv preprint — weeks to months (a deliberate trade-off for real institution data; see arXiv fallback below)",
    coverageGaps: "no institution country on works with no structured affiliation match — falls back to raw-affiliation-text inference, tagged provenance \"auto\" when it does",
  },
  {
    key: "arxiv-fallback",
    sourceName: "arXiv (fallback)",
    pollCadence: "same as OpenAlex — only reached when OpenAlex itself is unreachable",
    structuralLag: "near-real-time (preprint), but no institution country data at all",
    coverageGaps: "country is keyword-inferred from author affiliation text, provenance \"auto\" — not a lookup",
  },
  {
    key: "epo",
    sourceName: "EPO Patents",
    pollCadence: "every 3 hours (the same GitHub Actions run as every other automated source)",
    structuralLag: "~18 months typical (patent office filing-to-publication lag)",
    coverageGaps: "needs EPO_KEY/EPO_SECRET — skipped entirely (soft-fail) if unset",
  },
  {
    key: "nsf",
    sourceName: "NSF Awards",
    pollCadence: "every 3 hours (GitHub Actions)",
    structuralLag: "NSF typically posts an award within days to a few weeks of the funding decision",
    coverageGaps: "US-only — no public machine-readable feed exists for China's NSFC; investment stage is US/EU-weighted by construction, not a judgment call",
  },
  {
    key: "usaspending",
    sourceName: "USASpending.gov (federal awards)",
    pollCadence: "every 3 hours (GitHub Actions) — free, no key",
    structuralLag: "USASpending typically posts within days to weeks of contract execution",
    coverageGaps: "US federal contracts only — no state, no non-US, no private-sector procurement; only covers this vertical's hand-picked ticker list, one recipient+keyword query per company, so a company under a slightly different legal name on a given award may be missed",
  },
  {
    key: "agency-grants",
    sourceName: "Federal research grants by program (USASpending)",
    pollCadence: "every 3 hours (GitHub Actions) — free, no key; only configured for verticals where NSF's keyword search is measurably the wrong instrument",
    structuralLag: "USASpending typically posts within days to weeks of award execution",
    coverageGaps: "US federal assistance awards only, so the same US weighting NSF carries. Filtered by the funder's own CFDA program number rather than by keyword, which is why it is on-topic where NSF is not — but it is a top-100-by-award-size sample rather than a census, since the real result set is larger than one page. Only space is configured (NASA 43.012 Space Technology); NIH for biotechnology is the obvious next addition and is unbuilt.",
  },
  {
    key: "sam-gov",
    sourceName: "SAM.gov Opportunities (federal solicitations)",
    pollCadence: "attempted every 3-hour build run, but a non-federal SAM_KEY has a real DAILY quota (confirmed by hand 2026-07-26 via a live 429 response) — most runs in a given UTC day will find the quota already spent and skip, so the real effective cadence is closer to once/day",
    structuralLag: "near-real-time when a run does succeed — solicitations post as agencies publish them",
    coverageGaps: "needs SAM_KEY — skipped entirely (soft-fail) if unset or if the day's quota is already spent; US federal solicitations only, and a solicitation's real awardee (once one exists) is read defensively from a field shape not yet confirmed against a live awarded example",
  },
  {
    key: "rss-news",
    sourceName: "Trade-press RSS (scaling/adoption)",
    pollCadence: "every 3 hours (GitHub Actions)",
    structuralLag: "near-real-time — as fast as the trade press publishes",
    coverageGaps: "keyword-classified, provenance \"auto\" — weakest attribution tier; stage/country calls are a guess, disclosed on every such entry",
  },
  {
    key: "rss-investment",
    sourceName: "Google News (investment)",
    pollCadence: "every 3 hours (GitHub Actions)",
    structuralLag: "near-real-time",
    coverageGaps: "keyword-classified, provenance \"auto\"; personal/non-commercial use license only",
  },
  {
    key: "massive",
    sourceName: "Massive (public markets)",
    pollCadence: "every 3 hours (GitHub Actions)",
    structuralLag: "near-real-time exchange data, snapshot at fetch time — not live-updating between runs",
    coverageGaps: "needs MASSIVE_KEY — skipped entirely (soft-fail) if unset; covers only the hand-picked ticker list per vertical, not every company in the space",
  },
  {
    key: "sec-edgar",
    sourceName: "SEC EDGAR (corporate R&D spend)",
    pollCadence: "every 3 hours (GitHub Actions) — free, no key",
    structuralLag: "10-K filings post annually, weeks after fiscal year end",
    coverageGaps: "only covers this vertical's hand-picked ticker list, and only companies that tag a standalone R&D expense concept — Amazon, for one, folds R&D into a broader 'technology and infrastructure' line with no clean tag and is skipped rather than force-fit",
  },
  {
    key: "capiq",
    sourceName: "S&P Capital IQ (foreign R&D spend)",
    pollCadence: "manual — re-run scripts/import-capiq-rd-export.ts after a fresh export, not on any automated schedule",
    structuralLag: "however current the last manual export was — this can go stale between imports, unlike every live source here",
    coverageGaps: "only the specific foreign 20-F filers hand-added to CAPIQ_TICKERS_BY_VERTICAL (fetch-data.ts) — not a general foreign-company feed",
  },
  {
    key: "capiq-transactions",
    sourceName: "S&P Capital IQ (VC funding)",
    pollCadence: "manual — re-run scripts/import-capiq-transactions.ts after a fresh export, not on any automated schedule",
    structuralLag: "however current the last manual export was — this can go stale between imports, unlike every live source here",
    coverageGaps: "entity-consolidated by a heuristic (entityResolution.ts), not a real entity-ID join — the export has no ID column; covers whatever date range and industry tag the export was built with, not necessarily full history",
  },
  {
    key: "pitchbook-transactions",
    sourceName: "PitchBook via WRDS (VC + PE funding)",
    pollCadence: "manual — re-run `npm run import-pitchbook -- <vertical-id>` locally against WRDS whenever fresh data is wanted; deliberately never automated (see scripts/import-pitchbook.ts's header comment on why this stays a personal-credential, manual pull, not a CI-scheduled one)",
    structuralLag: "however current the last manual import was — WRDS itself 'does not maintain historical snapshots,' so a real deal that ages out of PitchBook's current-state view isn't detected, just never updated further",
    coverageGaps: "entity-consolidated by the same heuristic as CapIQ (entityResolution.ts) — a company may appear as a separate row from its CapIQ counterpart rather than one merged entity; quantum coverage is a keyword search against company text (no dedicated PitchBook tag exists), a weaker precision tier than AI's real vertical-tag match",
  },
  {
    key: "seed",
    sourceName: "Hand-verified seed",
    pollCadence: "manual — added by a human when a milestone is checked against its source, not on any fetch schedule",
    structuralLag: "none — verified at the time it's added, dated to the real event",
    coverageGaps: "only as complete as the hand-curation effort behind it; supplements, does not replace, the live RSS layer",
  },
];

// `succeeded` reports this run's outcome per source key (true = fetched
// successfully this run, false = attempted and failed, absent = not
// attempted, e.g. EPO with no key set). A failure carries the PREVIOUS
// `lastSuccessfulPull` forward rather than clearing it — "last successful,"
// not "last attempted," same soft-fail ethos as everywhere else in this app.
// One entry per missed DAY, not per missed run. 45 days is deliberately a
// little longer than the worst real incident (EPO's 45-day gap) so a problem
// of that size is still fully visible rather than half-truncated, and small
// enough that 15 sources x 45 dates stays a few KB in a file every visitor
// downloads.
const MAX_RECENT_MISSES = 45;

// The field is called recentMisses and has to mean it. Bounding only by
// COUNT was a bug: a source that failed three days in January and has been
// perfect since would still surface those three as "recent" eight months
// later, sitting next to a "last successful pull 12h ago" line. Age is the
// bound that matches the word; the count bound stays as a payload guard.
//
// 90 days is chosen to be comfortably longer than the worst real incident
// (EPO's 45-day gap) so such a gap is never half-truncated while it is still
// the live problem, and short enough that "recent" is defensible.
const MAX_MISS_AGE_DAYS = 90;

function recordMiss(
  prior: { date: string; outcome: "failed" | "not-attempted" }[] | undefined,
  outcome: "ok" | "failed" | "not-attempted",
  now: string,
): { date: string; outcome: "failed" | "not-attempted" }[] | undefined {
  const day = now.slice(0, 10);
  const cutoff = new Date(Date.parse(day) - MAX_MISS_AGE_DAYS * 864e5).toISOString().slice(0, 10);
  // Prune on every run, including healthy ones — otherwise a source that
  // recovers keeps stale misses forever, since pruning would only happen the
  // next time it broke.
  const history = (prior ?? []).filter((m) => m.date >= cutoff && m.date !== day);
  if (outcome === "ok") return history.length > 0 ? history : undefined;
  // Today is re-added rather than kept from `prior`, so a day that starts
  // not-attempted and later genuinely fails ends up described by its worse
  // outcome instead of counted twice.
  return [...history, { date: day, outcome }].slice(-MAX_RECENT_MISSES);
}

export function buildSourceMeta(
  prev: SourceMeta[] | undefined,
  // Three-valued on purpose, and the `undefined` case is load-bearing:
  // true = fetched, false = attempted and errored, ABSENT = not attempted
  // at all. Callers must pass undefined rather than false for a source that
  // was never tried, because "EPO has no credentials" and "EPO is broken"
  // are different facts and the disclosure panel reports them differently.
  succeeded: Record<string, boolean | undefined>,
  now: string,
): SourceMeta[] {
  const prevByName = new Map((prev ?? []).map((m) => [m.sourceName, m]));
  return SOURCE_TEMPLATE.map((t) => {
    const prior = prevByName.get(t.sourceName);
    const ok = succeeded[t.key];
    const outcome = ok === true ? "ok" : ok === false ? "failed" : ("not-attempted" as const);
    return {
      sourceName: t.sourceName,
      lastSuccessfulPull: ok ? now : prior?.lastSuccessfulPull ?? null,
      pollCadence: t.pollCadence,
      structuralLag: t.structuralLag,
      coverageGaps: t.coverageGaps,
      key: t.key,
      // `succeeded[key]` is deliberately three-valued — true, false, or
      // absent — and this is the only place that distinction survives into
      // the shipped file. Collapsing false and absent together is what made
      // "EPO has no credentials" indistinguishable from "EPO is fine" for 45
      // days.
      lastRunOutcome: outcome,
      recentMisses: recordMiss(prior?.recentMisses, outcome, now),
    } satisfies SourceMeta;
  });
}
