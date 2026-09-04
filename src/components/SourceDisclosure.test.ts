import { describe, it, expect } from "vitest";
import type { SourceMeta } from "../lib/types.ts";
import { buildSourceMeta } from "../lib/sourceMeta.ts";
import { health, missSummary } from "./SourceDisclosure.tsx";

const BUILD = Date.parse("2026-09-03T18:40:00Z");
const iso = (msAgo: number) => new Date(BUILD - msAgo).toISOString();

function meta(overrides: Partial<SourceMeta>): SourceMeta {
  return {
    sourceName: "EPO Patents", key: "epo",
    lastSuccessfulPull: iso(0), pollCadence: "every 3 hours (GitHub Actions)",
    structuralLag: "~18 months", coverageGaps: "",
    ...overrides,
  };
}

describe("source health — a soft-failing source must not read as a merely quiet one", () => {
  it("reports a source that fetched this run as current", () => {
    expect(health(meta({ lastRunOutcome: "ok" }), BUILD).quality).toBe("verified");
  });

  // The regression this panel exists for. EPO_KEY/EPO_SECRET were absent from
  // GitHub Actions for 45 days: every run logged "patents skipped", stayed
  // green, and carried the last good timestamp forward. Nothing on the page
  // said so. "not-attempted" on a scheduled source must never read as fine.
  it("flags a scheduled source that was not attempted, even though it has a real past pull", () => {
    const h = health(meta({ lastRunOutcome: "not-attempted", lastSuccessfulPull: iso(45 * 864e5) }), BUILD);
    expect(h.quality).toBe("uncertain");
    expect(h.label).toBe("Not attempted");
    expect(h.detail).toContain("45d ago");
  });

  it("distinguishes a source that errored from one that was never configured", () => {
    expect(health(meta({ lastSuccessfulPull: null, lastRunOutcome: "failed" }), BUILD).label).toBe("Failing");
    expect(health(meta({ lastSuccessfulPull: null, lastRunOutcome: "not-attempted" }), BUILD).label).toBe("Not configured");
  });

  it("calls a scheduled source stale when its last pull falls well behind the build", () => {
    expect(health(meta({ lastSuccessfulPull: iso(4 * 864e5), lastRunOutcome: "ok" }), BUILD).label).toBe("Current");
    expect(health(meta({ lastSuccessfulPull: iso(4 * 864e5) }), BUILD).label).toBe("Stale");
  });

  // arXiv is only reached when OpenAlex is down; CapIQ/PitchBook/seed are
  // human-run imports. An idle one is working as designed, not broken.
  it("does not flag a deliberately unscheduled source for having no recent pull", () => {
    const arxiv = meta({ sourceName: "arXiv (fallback)", key: "arxiv-fallback", lastSuccessfulPull: null, lastRunOutcome: "not-attempted" });
    expect(health(arxiv, BUILD).label).toBe("Never");
    expect(health(arxiv, BUILD).quality).toBe("missing"); // reported, not accused
  });

  // Every data file committed before 2026-09-03 lacks both new fields.
  it("classifies a legacy row with no key or outcome without inventing a claim", () => {
    const legacy = meta({ key: undefined, lastRunOutcome: undefined });
    expect(health(legacy, BUILD).label).toBe("Current");
    const legacyArxiv = meta({
      key: undefined, lastRunOutcome: undefined, lastSuccessfulPull: null,
      sourceName: "arXiv (fallback)", pollCadence: "same as OpenAlex — only reached when OpenAlex itself is unreachable",
    });
    expect(health(legacyArxiv, BUILD).label).toBe("Never");
  });
});

describe("buildSourceMeta — the three-valued run outcome survives into the file", () => {
  it("maps true/false/absent onto ok/failed/not-attempted", () => {
    const out = buildSourceMeta(undefined, { openalex: true, "sam-gov": false }, iso(0));
    const by = (n: string) => out.find((m) => m.key === n)!;
    expect(by("openalex").lastRunOutcome).toBe("ok");
    expect(by("sam-gov").lastRunOutcome).toBe("failed");
    expect(by("epo").lastRunOutcome).toBe("not-attempted");
  });

  it("carries a previous successful pull forward through a failure rather than erasing it", () => {
    const first = buildSourceMeta(undefined, { epo: true }, iso(864e5));
    const second = buildSourceMeta(first, { epo: false }, iso(0));
    const epo = second.find((m) => m.key === "epo")!;
    expect(epo.lastSuccessfulPull).toBe(iso(864e5));
    expect(epo.lastRunOutcome).toBe("failed");
  });
});

// The bug these exist to prevent, found 2026-09-03 after the panel shipped.
// fetch-data.ts set EVERY key in its succeeded map to an explicit boolean,
// so lastRunOutcome could only ever be "ok" or "failed" — "not-attempted"
// was unreachable, and two sources were being actively misreported:
// unconfigured EPO read as "Failing / errored on the latest run" when it had
// never been called, and the arXiv fallback read as "Failing" every time
// OpenAlex succeeded and it simply wasn't needed. The root cause is that
// fetchPatents throws "EPO key/secret not set" rather than signalling a
// skip, so trackedFetch reports ok:false for both cases.
describe("the not-attempted state is reachable and distinct from failure", () => {
  it("calls an unconfigured scheduled source Not configured, never Failing", () => {
    const epo = buildSourceMeta(undefined, { epo: undefined }, iso(0)).find((m) => m.key === "epo")!;
    expect(epo.lastRunOutcome).toBe("not-attempted");
    expect(health(epo, BUILD).label).toBe("Not configured");
  });

  it("does not accuse the arXiv fallback of failing when OpenAlex succeeded", () => {
    // What fetch-data now passes: openalex true, so arxiv-fallback undefined.
    const built = buildSourceMeta(undefined, { openalex: true, "arxiv-fallback": undefined }, iso(0));
    const arxiv = built.find((m) => m.key === "arxiv-fallback")!;
    expect(arxiv.lastRunOutcome).toBe("not-attempted");
    expect(health(arxiv, BUILD).label).toBe("Never");
    expect(health(arxiv, BUILD).quality).toBe("missing"); // reported, not accused
  });

  it("still reports a fallback that was genuinely reached and failed", () => {
    // OpenAlex down AND arXiv down — the innovation stage has nothing, and
    // being a fallback must not exempt it from saying so.
    const built = buildSourceMeta(undefined, { openalex: false, "arxiv-fallback": false }, iso(0));
    const arxiv = built.find((m) => m.key === "arxiv-fallback")!;
    expect(arxiv.lastRunOutcome).toBe("failed");
    expect(health(arxiv, BUILD).label).toBe("Failing");
  });

  it("treats a static import with no rows as absent data rather than a failed fetch", () => {
    // Biotechnology's missing PitchBook coverage is the live case — a real
    // known gap, and not something that errored.
    const pb = buildSourceMeta(undefined, { "pitchbook-transactions": undefined }, iso(0))
      .find((m) => m.key === "pitchbook-transactions")!;
    expect(pb.lastRunOutcome).toBe("not-attempted");
    expect(health(pb, BUILD).label).toBe("Never");
  });
});

// The systemic gap behind every real incident this project has had: each
// individual run looked unremarkable while a source was quietly broken for
// weeks. lastRunOutcome is a snapshot and cannot express that. recentMisses
// accumulates one entry per missed UTC DAY (not per run — the build runs 8
// times a day, and 8 identical misses is one fact).
describe("recentMisses accumulates a real failure history", () => {
  const run = (prev: SourceMeta[] | undefined, ok: Record<string, boolean | undefined>, day: string) =>
    buildSourceMeta(prev, ok, `${day}T12:00:00.000Z`);
  const epoOf = (sm: SourceMeta[]) => sm.find((m) => m.key === "epo")!;

  it("records nothing while a source is healthy", () => {
    const sm = run(undefined, { epo: true }, "2026-09-01");
    expect(epoOf(sm).recentMisses).toBeUndefined();
  });

  it("records one entry per missed day, not per run", () => {
    let sm = run(undefined, { epo: undefined }, "2026-09-01");
    for (let i = 0; i < 8; i++) sm = run(sm, { epo: undefined }, "2026-09-01"); // 8 builds, same day
    expect(epoOf(sm).recentMisses).toHaveLength(1);
    sm = run(sm, { epo: undefined }, "2026-09-02");
    expect(epoOf(sm).recentMisses).toHaveLength(2);
  });

  it("distinguishes an unconfigured source from a failing one across days", () => {
    let sm = run(undefined, { epo: undefined }, "2026-09-01");
    sm = run(sm, { epo: false }, "2026-09-02");
    expect(epoOf(sm).recentMisses!.map((m) => m.outcome)).toEqual(["not-attempted", "failed"]);
  });

  it("upgrades a day to its worse outcome rather than double-counting it", () => {
    let sm = run(undefined, { epo: undefined }, "2026-09-01");
    sm = run(sm, { epo: false }, "2026-09-01"); // same day, now a real error
    const misses = epoOf(sm).recentMisses!;
    expect(misses).toHaveLength(1);
    expect(misses[0].outcome).toBe("failed");
  });

  it("keeps history after a source recovers, so a past incident stays visible", () => {
    let sm = run(undefined, { epo: undefined }, "2026-09-01");
    sm = run(sm, { epo: true }, "2026-09-02");
    expect(epoOf(sm).recentMisses).toHaveLength(1);
    expect(epoOf(sm).lastRunOutcome).toBe("ok");
  });

  // An unbounded log in a file every visitor downloads would make sourceMeta
  // the payload problem it exists to warn about.
  it("bounds the history so the payload cannot grow without limit", () => {
    let sm: SourceMeta[] | undefined;
    for (let d = 1; d <= 80; d++)
      sm = run(sm, { epo: undefined }, `2026-06-${String(d).padStart(2, "0")}`.replace(/-(\d\d)$/, (_, n) => `-${String(Math.min(28, +n)).padStart(2, "0")}`));
    expect(epoOf(sm!).recentMisses!.length).toBeLessThanOrEqual(45);
  });

  // The EPO incident, replayed: 45 days unconfigured while every run stayed
  // green. The history is what makes that legible.
  it("makes a 45-day silent gap visible", () => {
    let sm: SourceMeta[] | undefined;
    for (let d = 1; d <= 28; d++) sm = run(sm, { epo: undefined, openalex: true }, `2026-07-${String(d).padStart(2, "0")}`);
    const epo = epoOf(sm!);
    expect(epo.recentMisses!.length).toBe(28);
    expect(epo.recentMisses!.every((m) => m.outcome === "not-attempted")).toBe(true);
    // ...while a healthy source alongside it records nothing.
    expect(sm!.find((m) => m.key === "openalex")!.recentMisses).toBeUndefined();
  });
});

// An alarm that fires on every build is an alarm nobody reads. SAM.gov's
// non-federal key has a documented daily quota, so it misses most days by
// design — surfacing that in the headline forever would train a reader to
// ignore the headline, and the headline is the whole point on the day EPO
// goes quiet.
describe("a chronic-by-design source does not cry wolf", () => {
  const replay = (days: number, map: Record<string, boolean | undefined>) => {
    let sm: SourceMeta[] | undefined;
    for (let d = 1; d <= days; d++) sm = buildSourceMeta(sm, map, `2026-07-${String(d).padStart(2, "0")}T12:00:00.000Z`);
    return sm!;
  };

  it("still records SAM.gov's misses on its own row", () => {
    const sm = replay(20, { "sam-gov": false, openalex: true });
    expect(sm.find((m) => m.key === "sam-gov")!.recentMisses).toHaveLength(20);
  });

  it("keeps a genuinely broken source distinguishable from the expected one", () => {
    const sm = replay(20, { "sam-gov": false, epo: undefined, openalex: true });
    const epo = sm.find((m) => m.key === "epo")!;
    const sam = sm.find((m) => m.key === "sam-gov")!;
    // Both chronic in the data; the panel's headline filter is what separates
    // them, and it keys off the source id rather than the miss count.
    expect(epo.recentMisses!.length).toBe(20);
    expect(sam.recentMisses!.length).toBe(20);
    expect(epo.key).not.toBe(sam.key);
  });
});

// Two bugs found by auditing this file an hour after writing it.
describe("miss history does not overstate itself", () => {
  const run = (prev: SourceMeta[] | undefined, ok: Record<string, boolean | undefined>, day: string) =>
    buildSourceMeta(prev, ok, `${day}T12:00:00.000Z`);
  const epoOf = (sm: SourceMeta[]) => sm.find((m) => m.key === "epo")!;

  // Bug 1: bounded only by count, so misses from January still read as
  // "recent" in September, sitting beside a "last successful pull 12h ago".
  it("prunes misses older than the recency window", () => {
    let sm = run(undefined, { epo: false }, "2026-01-05");
    expect(epoOf(sm).recentMisses).toHaveLength(1);
    sm = run(sm, { epo: true }, "2026-09-04"); // eight months later, healthy
    expect(epoOf(sm).recentMisses).toBeUndefined();
  });

  it("prunes on healthy runs too, not only when something breaks", () => {
    // Otherwise stale entries survive indefinitely for a recovered source,
    // because pruning would only ever happen on a subsequent failure.
    let sm = run(undefined, { epo: false }, "2026-01-05");
    for (const d of ["2026-05-01", "2026-07-01", "2026-09-04"]) sm = run(sm, { epo: true }, d);
    expect(epoOf(sm).recentMisses).toBeUndefined();
  });

  it("keeps misses that are genuinely inside the window", () => {
    let sm = run(undefined, { epo: false }, "2026-08-20");
    sm = run(sm, { epo: true }, "2026-09-04");
    expect(epoOf(sm).recentMisses).toHaveLength(1);
  });

  // Bug 2: the summary ended "of the last N recorded" where N was the miss
  // count itself, so it always read "N of N" — which a reader parses as "the
  // last N runs all failed". recentMisses holds only misses, so no honest
  // denominator exists; the window start is reported instead.
  it("reports a window start rather than a denominator it cannot honestly supply", () => {
    const meta: SourceMeta = {
      sourceName: "EPO Patents", key: "epo", lastSuccessfulPull: "2026-09-04T00:00:00Z",
      pollCadence: "every 3 hours", structuralLag: "~18 months", coverageGaps: "",
      lastRunOutcome: "ok",
      recentMisses: [
        { date: "2026-08-01", outcome: "failed" },
        { date: "2026-08-02", outcome: "failed" },
        { date: "2026-08-03", outcome: "not-attempted" },
      ],
    };
    const summary = missSummary(meta)!;
    expect(summary).toContain("errored on 2 days");
    expect(summary).toContain("not attempted on 1 day");
    expect(summary).toContain("since 2026-08-01");
    expect(summary).not.toMatch(/of the last/);
  });
});
