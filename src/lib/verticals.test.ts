import { describe, it, expect } from "vitest";
import { VERTICALS } from "./verticals.ts";

// VERTICALS is the single source of truth every fetch path reads from, and a
// malformed entry fails soft like everything else here — which means a typo
// costs a whole source silently rather than loudly. These are the cheap
// structural checks that would otherwise be a CLAUDE.md checklist nobody
// re-reads.
describe("VERTICALS config integrity", () => {
  it("has unique ids, numbers and data directories", () => {
    for (const field of ["id", "number", "dataDir"] as const) {
      const values = VERTICALS.map((v) => v[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
  });

  it("gives every vertical the fields every fetch path assumes", () => {
    for (const v of VERTICALS) {
      expect(v.label, v.id).toBeTruthy();
      expect(v.shortLabel, v.id).toBeTruthy();
      expect(v.fundingKeyword, v.id).toBeTruthy();
      expect(v.rssFeeds.length, `${v.id} has no RSS feeds`).toBeGreaterThan(0);
      expect(v.tickers.length, `${v.id} has no tickers`).toBeGreaterThan(0);
    }
  });

  it("keeps every ticker list free of duplicates", () => {
    for (const v of VERTICALS)
      expect(new Set(v.tickers).size, `${v.id} has a duplicate ticker`).toBe(v.tickers.length);
  });

  // Added with the NASA grants source. fetchFederalGrants returns [] on an
  // empty program list and fetch-data only calls it when BOTH fields are
  // set, so half a config is a source that silently never runs — exactly the
  // failure mode that hid the missing EPO credentials for 45 days.
  it("has grant-agency config either fully set or fully absent", () => {
    for (const v of VERTICALS) {
      const hasAgency = Boolean(v.grantAgency);
      const hasPrograms = Boolean(v.grantProgramNumbers?.length);
      expect(hasAgency, `${v.id}: grantAgency set without grantProgramNumbers, or vice versa`).toBe(hasPrograms);
    }
  });

  it("uses well-formed CFDA program numbers where configured", () => {
    for (const v of VERTICALS)
      for (const n of v.grantProgramNumbers ?? [])
        expect(n, `${v.id}: ${n} is not a CFDA number`).toMatch(/^\d{2}\.\d{3}$/);
  });

  // Space is the one vertical where this repo measured NSF to be the wrong
  // instrument — NSF funds space science, and a "space technology" keyword
  // matches 7% of what it returns. NASA's own 43.012 program is ~85%
  // on-topic. If someone removes this, the investment stage silently reverts
  // to the worse source.
  it("keeps NASA Space Technology wired for the space vertical", () => {
    const space = VERTICALS.find((v) => v.id === "space")!;
    expect(space.grantAgency).toBe("National Aeronautics and Space Administration");
    expect(space.grantProgramNumbers).toContain("43.012");
  });

  it("falls back to fundingKeyword when procurementKeyword is unset", () => {
    // Documents the intended contract rather than asserting a value: the
    // fetch path reads `procurementKeyword ?? fundingKeyword`, so an unset
    // procurementKeyword must never be an empty string, which would query
    // for nothing instead of falling back.
    for (const v of VERTICALS)
      if (v.procurementKeyword !== undefined) expect(v.procurementKeyword, v.id).toBeTruthy();
  });
});
