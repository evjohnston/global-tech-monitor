import { describe, it, expect } from "vitest";
import type { Entry, TrendPoint } from "./types.ts";
import { fundingByCountry, periodFunding, loadHistory } from "./aggregate.ts";

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: "e1", stage: "investment", country: "US", provenance: "live", source: "grant",
    title: "A real award", org: "NSF", date: "2026-09-01", url: "https://example.com",
    ...overrides,
  };
}

// The regression these guard is documented in CLAUDE.md and was measured,
// not hypothesised: AI's real data held $267B of private funding rounds
// against $230M of NSF grants, so letting one Anthropic round into these
// sums distorted the public-investment figure by roughly 1000x. Three call
// sites filter to source === "grant" for that reason. Nothing asserted it
// until now, which left a 1000x error one careless edit away.
describe("public-investment aggregates count government grants only", () => {
  const mixed = [
    entry({ id: "g1", source: "grant", country: "US", amountUsd: 1_000_000 }),
    entry({ id: "g2", source: "grant", country: "DE", amountUsd: 500_000 }),
    // Space's real seeded rounds, the ones that made this worth testing.
    entry({ id: "r1", source: "funding-round", country: "US", amountUsd: 1_400_000_000, provenance: "seeded" }),
    entry({ id: "r2", source: "funding-round", country: "FI", amountUsd: 520_000_000, provenance: "seeded" }),
    entry({ id: "r3", source: "funding-round", country: "IN", amountUsd: 60_000_000, provenance: "seeded" }),
  ];

  it("excludes private rounds from funding by country", () => {
    expect(fundingByCountry(mixed)).toEqual({ US: 1_000_000, DE: 500_000 });
  });

  it("leaves a country whose only investment entry is a private round out entirely", () => {
    // Not zero, and not present with a value — absent. A "Finland: $0" row
    // would read as "Finland gets no public funding," a different claim
    // from "this app tracks no public funding for Finland."
    const byCountry = fundingByCountry(mixed);
    expect("FI" in byCountry).toBe(false);
    expect("IN" in byCountry).toBe(false);
  });

  it("excludes private rounds from the period-over-period public figure", () => {
    const now = new Date("2026-09-03T00:00:00Z");
    const { current } = periodFunding(mixed, 21, now);
    expect(current).toBe(1_500_000);
  });

  it("ignores investment-stage entries with no amount rather than counting them as zero-dollar awards", () => {
    const withMissing = [...mixed, entry({ id: "g3", source: "grant", country: "US" })];
    expect(fundingByCountry(withMissing).US).toBe(1_000_000);
  });

  it("does not count a grant filed under another stage", () => {
    const misstaged = [entry({ id: "x", stage: "innovation", source: "grant", amountUsd: 9_000_000 })];
    expect(fundingByCountry(misstaged)).toEqual({});
  });
});

// loadHistory segments trend[] by the ceiling each point was counted
// against. CLAUDE.md records what it cost to get this wrong: backfilled
// points counted to 1,600 works while recorded points counted to 600,
// rendering as a spike-then-collapse at the left edge of every chart.
describe("loadHistory keeps only points comparable with the newest one", () => {
  const p = (date: string, windowCap?: number): TrendPoint =>
    ({ date, counts: { US: 1 }, ...(windowCap == null ? {} : { windowCap }) }) as TrendPoint;

  // Every point recorded before windowCap existed lacks the field. Treating
  // absence as "unknown" rather than as the legacy 600 would discard all of
  // production's real history — 75 quantum points and 51 AI points when
  // this was measured.
  it("treats a missing windowCap as the legacy ceiling, not as unknown", () => {
    const trend = [p("2026-07-20"), p("2026-07-21"), p("2026-07-22", 600)];
    expect(loadHistory(trend).length).toBe(3);
  });

  it("drops points counted against a different ceiling", () => {
    const trend = [p("2026-06-20", 1600), p("2026-07-20", 600), p("2026-07-21", 600)];
    const kept = loadHistory(trend);
    expect(kept.map((x) => x.date)).toEqual(["2026-07-20", "2026-07-21"]);
  });

  it("keeps the file intact when every point shares one ceiling", () => {
    const trend = [p("2026-07-20", 1600), p("2026-07-21", 1600)];
    expect(loadHistory(trend).length).toBe(2);
  });

  it("handles an empty series without throwing", () => {
    expect(loadHistory([])).toEqual([]);
  });
});
