import { useMemo } from "react";
import type { SourceMeta } from "../lib/types.ts";
import { ChartFrame, DataQualityBadge, EmptyState, type DataQuality } from "./ChartFrame.tsx";

// `sourceMeta` has been written into every data file since the beginning and
// rendered by nothing — no component referenced it until this one. It is the
// per-source disclosure of how current each upstream is, what it structurally
// can't tell us, and where its coverage has holes, which is exactly the kind
// of caveat this app insists on putting on the page rather than in a footnote.
//
// The panel exists mainly to make one failure mode visible. Every source here
// fails soft by design, so a source that stops working leaves the build green
// and its `lastSuccessfulPull` simply stops advancing. That is how the missing
// EPO credentials went unnoticed for 45 days. A reader looking at this table
// would have seen "EPO Patents — not configured" on day one.

// How far behind the file's own generation a scheduled source's last
// successful pull can sit before it reads as failing rather than periodic.
// The automated sources all run in the same every-3-hours GitHub Actions job,
// so a day and a half of drift means the source itself has been erroring
// across roughly a dozen consecutive runs.
const STALE_MS = 36 * 3600e3;

// Sources whose whole design is to sit idle, so an absent recent pull is not a
// fault and must not be flagged as one: the arXiv path is only reached when
// OpenAlex itself is unreachable, and the CapIQ/PitchBook/seed rows are
// human-run imports with no schedule at all. Keyed off the stable `key`
// rather than the cadence prose, which is written for readers and will change.
const UNSCHEDULED = new Set([
  "arxiv-fallback",
  "capiq",
  "capiq-transactions",
  "pitchbook-transactions",
  "seed",
]);

// `key` is absent on every file written before 2026-09-03, and without it the
// set above can't match — which would count two deliberately-idle sources as
// problems. Fall back to the cadence prose in that case: it's the only signal
// a legacy file carries, and it only has to hold until the next build stamps a
// real key. Same normalise-absence discipline as TrendPoint.windowCap.
function isUnscheduled(m: SourceMeta): boolean {
  if (m.key != null) return UNSCHEDULED.has(m.key);
  return /^manual\b|only reached when/.test(m.pollCadence);
}

type Health = { quality: DataQuality; label: string; detail: string };

// A source that missed once is noise. A source that has missed many of the
// last N days is the thing this panel exists to catch, and until now it read
// identically to the first. Phrased as a count of DAYS because that is what
// recentMisses records — the build runs 8 times a day, so counting runs would
// multiply every incident by 8 and make a bad week look like a catastrophe.
export function missSummary(m: SourceMeta): string | null {
  const misses = m.recentMisses ?? [];
  if (misses.length === 0) return null;
  const failed = misses.filter((x) => x.outcome === "failed").length;
  const skipped = misses.length - failed;
  const parts = [
    failed > 0 ? `errored on ${failed} day${failed === 1 ? "" : "s"}` : null,
    skipped > 0 ? `not attempted on ${skipped} day${skipped === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  // No denominator, deliberately. An earlier version ended "of the last N
  // recorded" where N was the MISS count, so it always read "3 of the last 3"
  // — which a reader parses as "the last three runs all failed," a far
  // stronger claim than the data supports. recentMisses records only misses,
  // so there is no honest denominator available here. The window start is
  // given instead, which is both true and the thing that tells a reader
  // whether this is happening now or is old news.
  return `${parts.join(", ")} since ${misses[0].date}`;
}

// Sources whose chronic missing is a KNOWN, documented property rather than
// a problem to raise. SAM.gov is the only one: a non-federal SAM_KEY has a
// real daily quota, so most runs in a UTC day find it spent and soft-fail —
// CLAUDE.md records that as "expected, not a regression."
//
// Exempting it is not cosmetic. A headline warning that fires on every
// single build teaches a reader to ignore the headline, which would destroy
// the one thing this panel is for — being believed the day EPO goes quiet.
// The row still shows its miss count, so the behaviour stays visible to
// anyone reading the table; it just doesn't cry wolf above it.
const CHRONIC_BY_DESIGN = new Set(["sam-gov"]);

// Persistent trouble, as opposed to a bad day.
const PERSISTENT_MISS_DAYS = 7;
function isPersistentlyMissing(m: SourceMeta): boolean {
  return (m.recentMisses ?? []).length >= PERSISTENT_MISS_DAYS;
}

function relativeAge(fromIso: string, toMs: number): string {
  const ms = toMs - new Date(fromIso).getTime();
  if (!Number.isFinite(ms)) return "unknown";
  const hours = ms / 3600e3;
  if (hours < 1) return "under an hour ago";
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Exported for src/components/SourceDisclosure.test.ts — the six-state
// classification is the load-bearing logic here and is worth testing
// directly rather than by scraping rendered markup.
//
// Six states, every one derived from data rather than asserted: not
// configured, never succeeded, failing, not attempted, stale, current.
// `lastRunOutcome` is absent on every file written before 2026-09-03, so its
// absence falls back to judging freshness by timestamp drift alone — the best
// that older files support, and never a claim they don't carry.
export function health(m: SourceMeta, generatedMs: number): Health {
  const scheduled = !isUnscheduled(m);

  if (m.lastSuccessfulPull == null) {
    // Never succeeded, but there are three different reasons for that and
    // they call for different reading. SAM.gov is the live example of the
    // first: it has a real daily quota, so it genuinely errors most runs
    // and has no successful pull to show — that is failing, not idle.
    if (m.lastRunOutcome === "failed") {
      return { quality: "uncertain", label: "Failing", detail: "errored on the latest run and has never returned data" };
    }
    if (scheduled && m.lastRunOutcome === "not-attempted") {
      return { quality: "missing", label: "Not configured", detail: "no credentials set, so this source has never been fetched" };
    }
    return { quality: "missing", label: "Never", detail: "this source has not returned data yet" };
  }

  const age = relativeAge(m.lastSuccessfulPull, generatedMs);

  if (m.lastRunOutcome === "failed") {
    return { quality: "uncertain", label: "Failing", detail: `errored on the latest run; the data shown was last refreshed ${age}` };
  }
  if (m.lastRunOutcome === "not-attempted" && scheduled) {
    return { quality: "uncertain", label: "Not attempted", detail: `skipped on the latest run; last real pull ${age}` };
  }
  // An explicit success this run settles it, and must be checked before the
  // drift test below. Otherwise a source that genuinely just fetched could
  // still be called stale on a file whose own `generatedAt` is older than the
  // pull it records — which is what a re-run against a carried-forward file
  // looks like.
  if (m.lastRunOutcome === "ok") {
    return { quality: "verified", label: "Current", detail: `last successful pull ${age}` };
  }
  if (scheduled && generatedMs - new Date(m.lastSuccessfulPull).getTime() > STALE_MS) {
    return { quality: "uncertain", label: "Stale", detail: `last successful pull ${age}, well behind this build` };
  }
  return { quality: "verified", label: "Current", detail: `last successful pull ${age}` };
}

export function SourceDisclosure({ sourceMeta, generated }: { sourceMeta: SourceMeta[]; generated: string }) {
  const generatedMs = useMemo(() => {
    const t = new Date(generated).getTime();
    return Number.isFinite(t) ? t : Date.now();
  }, [generated]);

  const rows = useMemo(
    () => sourceMeta.map((m) => ({ meta: m, health: health(m, generatedMs) })),
    [sourceMeta, generatedMs],
  );

  // Stated as a count rather than a reassurance — "everything is fine" is not
  // this panel's job, and the number is the thing a reader can check.
  //
  // An unscheduled source sitting idle is working as designed and is not a
  // problem. One that was actually ATTEMPTED and errored is, even if it is
  // unscheduled — if OpenAlex is down and the arXiv fallback then fails too,
  // the innovation stage has nothing, and that must not be filtered out of
  // the count for being a fallback.
  const problems = rows.filter(
    (r) => r.health.quality !== "verified" && (!isUnscheduled(r.meta) || r.meta.lastRunOutcome === "failed"),
  );
  const takeaway = rows.length === 0
    ? "No source metadata in this data file."
    : problems.length === 0
      ? `All ${rows.length} tracked sources returned data on the latest build.`
      : `${problems.length} of ${rows.length} sources did not return fresh data on the latest build` +
        ` — ${problems.map((p) => p.meta.sourceName).join(", ")}.`;

  // Called out separately from the latest-build count, because the two say
  // different things. A source can be fine today and still have been broken
  // for a month, which is exactly how the missing EPO credentials stayed
  // invisible for 45 days while every individual run looked green.
  const chronic = rows.filter(
    (r) => isPersistentlyMissing(r.meta) && !isUnscheduled(r.meta) && !CHRONIC_BY_DESIGN.has(r.meta.key ?? ""),
  );

  return (
    <ChartFrame
      title="How current is each source, and what can't it tell us?"
      takeaway={
        chronic.length === 0 ? takeaway : (
          <>
            {takeaway}{" "}
            <strong>
              {chronic.length === 1 ? "One source has" : `${chronic.length} sources have`} missed{" "}
              {PERSISTENT_MISS_DAYS}+ recent days — {chronic.map((c) => c.meta.sourceName).join(", ")}.
            </strong>
          </>
        )
      }
      empty={rows.length === 0 ? <EmptyState>This data file carries no source metadata.</EmptyState> : undefined}
      legend={
        <span>
          Every source here fails soft — a missing key or a down endpoint drops that one source without breaking the
          build. That means a broken source looks like a quiet one, which is what this table is for. Structural lag and
          coverage gaps are properties of the upstream source itself, not of this app's handling of it.
        </span>
      }
    >
      <table className="lb source-disclosure">
        <thead>
          <tr>
            <th>Source</th>
            <th>Latest build</th>
            <th>Cadence</th>
            <th>Structural lag</th>
            <th>Coverage gaps</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ meta, health: h }) => (
            <tr key={meta.sourceName}>
              <td className="org-name">{meta.sourceName}</td>
              <td>
                <DataQualityBadge status={h.quality} label={h.label} />
                <div className="source-disclosure-detail">{h.detail}</div>
                {missSummary(meta) && (
                  <div className="source-disclosure-detail">
                    {isPersistentlyMissing(meta) ? <strong>{missSummary(meta)}</strong> : missSummary(meta)}
                  </div>
                )}
              </td>
              <td className="source-disclosure-prose">{meta.pollCadence}</td>
              <td className="source-disclosure-prose">{meta.structuralLag}</td>
              <td className="source-disclosure-prose">{meta.coverageGaps || "none material"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartFrame>
  );
}
