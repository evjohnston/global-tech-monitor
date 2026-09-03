import { describe, it, expect } from "vitest";
import type { RdSpendPoint } from "./types.ts";
import { exposureBreakdown, pureplayShare, restrictToPurePlay, applyExposureMode } from "./rdExposure.ts";

// Real symbols with their real exposure classes from companyCategory.ts, so
// these tests exercise the actual classification rather than a stub of it.
// Verified against companyCategory.ts rather than assumed: in quantum,
// IONQ/RGTI are pure-plays, IBM/MSFT/GOOGL/NVDA are all platform providers,
// AMAT is a major supplier and LMT is a user-adopter. NVDA being a platform
// provider here rather than a supplier is why this comment now cites the
// real values.
const point = (fiscalYear: number, companies: [string, number][]): RdSpendPoint => ({
  fiscalYear,
  totalUsd: companies.reduce((s, [, a]) => s + a, 0),
  companies: companies.map(([symbol, amountUsd]) => ({ symbol, amountUsd, source: "sec" as const })),
});

describe("exposureBreakdown — where the headline number actually comes from", () => {
  it("partitions a point by real exposure class, largest first", () => {
    const b = exposureBreakdown("quantum-computing", point(2025, [["IONQ", 100], ["IBM", 700], ["RGTI", 100], ["AMAT", 100]]));
    expect(b[0].exposure).toBe("platform-provider");
    expect(b[0].totalUsd).toBe(700);
    expect(b[0].sharePct).toBeCloseTo(70);
    const pure = b.find((x) => x.exposure === "pure-play")!;
    expect(pure.companies).toBe(2);
    expect(pure.totalUsd).toBe(200);
  });

  it("does not divide by zero on a point with no spend", () => {
    const b = exposureBreakdown("quantum-computing", point(2025, [["IONQ", 0]]));
    expect(b[0].sharePct).toBe(0);
  });
});

describe("pureplayShare — the overstatement, stated as a number", () => {
  // The shape of the real shipped quantum figure: pure-plays are 0.23% of a
  // $198.9B headline. A reader told "$198.9B of quantum R&D" is being
  // misled by more than two orders of magnitude.
  it("reports a small share as a small share rather than rounding it away", () => {
    const s = pureplayShare("quantum-computing", point(2025, [["IONQ", 451], ["IBM", 198_000]]))!;
    expect(s.companies).toBe(1);
    expect(s.pureplayUsd).toBe(451);
    expect(s.sharePct).toBeLessThan(1);
    expect(s.sharePct).toBeGreaterThan(0);
  });

  // AI's real case, and the reason this returns null rather than 0. "There
  // is no pure-play public AI company" is a different claim from "pure-plays
  // spend ~0%", and the UI has to be able to say the first.
  it("returns null when the vertical has no pure-play filer at all", () => {
    expect(pureplayShare("artificial-intelligence", point(2024, [["MSFT", 29_000], ["NVDA", 12_000]]))).toBeNull();
  });
});

describe("restrictToPurePlay — a year with no pure-play filer is absent, not zero", () => {
  // The load-bearing case. IonQ, Rigetti and D-Wave were not public filers
  // before 2021-2022, so quantum's early years hold no pure-play data. A $0
  // point would read as "they spent nothing", which is a different and false
  // claim from "nobody was measurable yet".
  it("drops years with no pure-play company instead of plotting zero", () => {
    const series = [
      point(2019, [["IBM", 6_000]]),
      point(2020, [["IBM", 6_300]]),
      point(2021, [["IBM", 6_500], ["IONQ", 30]]),
      point(2022, [["IBM", 6_600], ["IONQ", 60], ["RGTI", 40]]),
    ];
    const pure = restrictToPurePlay("quantum-computing", series);
    expect(pure.map((p) => p.fiscalYear)).toEqual([2021, 2022]);
    expect(pure.every((p) => p.totalUsd > 0)).toBe(true);
  });

  it("recomputes totalUsd from the surviving companies, never carrying the full total over", () => {
    const pure = restrictToPurePlay("quantum-computing", [point(2022, [["IBM", 6_600], ["IONQ", 60]])]);
    expect(pure[0].totalUsd).toBe(60);
    expect(pure[0].companies.map((c) => c.symbol)).toEqual(["IONQ"]);
  });

  it("returns an empty series for a vertical with no pure-plays, so the caller must handle it", () => {
    expect(restrictToPurePlay("artificial-intelligence", [point(2024, [["MSFT", 29_000]])])).toEqual([]);
  });

  it("does not mutate the input points", () => {
    const series = [point(2022, [["IBM", 6_600], ["IONQ", 60]])];
    restrictToPurePlay("quantum-computing", series);
    expect(series[0].companies.length).toBe(2);
    expect(series[0].totalUsd).toBe(6_660);
  });
});

describe("applyExposureMode", () => {
  it("passes the series through untouched in all mode", () => {
    const series = [point(2022, [["IBM", 6_600], ["IONQ", 60]])];
    expect(applyExposureMode("quantum-computing", series, "all")).toBe(series);
  });

  it("restricts in pure-play mode", () => {
    const series = [point(2022, [["IBM", 6_600], ["IONQ", 60]])];
    expect(applyExposureMode("quantum-computing", series, "pure-play")[0].totalUsd).toBe(60);
  });
});
