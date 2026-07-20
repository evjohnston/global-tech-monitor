import type { SourceMeta } from "./types.ts";

// One entry per real upstream source (not per vertical — the sources are
// the same shape everywhere; only which ones are configured/succeed can
// differ). `key` is the stable id fetch-data.ts reports success/failure
// against; `cadence`/`lag`/`gaps` are facts about the source, not computed.
const SOURCE_TEMPLATE: { key: string; sourceName: string; pollCadence: string; structuralLag: string; coverageGaps: string }[] = [
  {
    key: "openalex",
    sourceName: "OpenAlex (papers)",
    pollCadence: "nightly (GitHub Actions, ~07:00 UTC) + live browser refresh every ~3 min while a tab is open",
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
    pollCadence: "nightly + live browser refresh (same cadence as OpenAlex)",
    structuralLag: "~18 months typical (patent office filing-to-publication lag)",
    coverageGaps: "needs EPO_KEY/EPO_SECRET — skipped entirely (soft-fail) if unset",
  },
  {
    key: "nsf",
    sourceName: "NSF Awards",
    pollCadence: "nightly + live browser refresh",
    structuralLag: "NSF typically posts an award within days to a few weeks of the funding decision",
    coverageGaps: "US-only — no public machine-readable feed exists for China's NSFC; investment stage is US/EU-weighted by construction, not a judgment call",
  },
  {
    key: "rss-news",
    sourceName: "Trade-press RSS (scaling/adoption)",
    pollCadence: "nightly + live browser refresh",
    structuralLag: "near-real-time — as fast as the trade press publishes",
    coverageGaps: "keyword-classified, provenance \"auto\" — weakest attribution tier; stage/country calls are a guess, disclosed on every such entry",
  },
  {
    key: "rss-investment",
    sourceName: "Google News (investment)",
    pollCadence: "nightly + live browser refresh",
    structuralLag: "near-real-time",
    coverageGaps: "keyword-classified, provenance \"auto\"; personal/non-commercial use license only",
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
export function buildSourceMeta(prev: SourceMeta[] | undefined, succeeded: Record<string, boolean>, now: string): SourceMeta[] {
  const prevByName = new Map((prev ?? []).map((m) => [m.sourceName, m]));
  return SOURCE_TEMPLATE.map((t) => {
    const prior = prevByName.get(t.sourceName);
    const ok = succeeded[t.key];
    return {
      sourceName: t.sourceName,
      lastSuccessfulPull: ok ? now : prior?.lastSuccessfulPull ?? null,
      pollCadence: t.pollCadence,
      structuralLag: t.structuralLag,
      coverageGaps: t.coverageGaps,
    };
  });
}
