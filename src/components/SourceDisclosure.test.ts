import { describe, it, expect } from "vitest";
import type { SourceMeta } from "../lib/types.ts";
import { buildSourceMeta } from "../lib/sourceMeta.ts";
import { health } from "./SourceDisclosure.tsx";

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
