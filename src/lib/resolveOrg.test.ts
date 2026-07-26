import { describe, it, expect } from "vitest";
import type { Entry, VcCompanyFunding, CompanySnapshot } from "./types.ts";
import { resolveOrgProfile } from "./resolveOrg.ts";
import { buildOrgFinancialIndex } from "./orgFinancials.ts";
import { canonicalizeOrg } from "./entityResolution.ts";
import { serializeDrawerTarget, parseDrawerTarget, type DrawerTarget } from "./drawerTarget.ts";
import { readUrlState, writeUrlState, technologySlug, verticalIdFromSlug } from "./urlState.ts";

function makeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: "e1", stage: "innovation", country: "US", provenance: "live", source: "paper",
    title: "A real paper", org: "IBM", date: "2026-01-01", url: "https://example.com",
    ...overrides,
  };
}

describe("resolveOrgProfile — every visible org link resolves to a real state, never a dead 'not found'", () => {
  it("resolves an org with real tracked entries", () => {
    const entries = [makeEntry({ id: "e1", org: "IBM" })];
    const idx = buildOrgFinancialIndex({});
    const result = resolveOrgProfile(entries, idx, canonicalizeOrg("IBM").id);
    expect(result.status).toBe("entries");
    if (result.status === "entries") expect(result.entries.length).toBe(1);
  });

  it("resolves a company with financial data but zero tracked entries (a real, expected case, not a bug)", () => {
    const entries: Entry[] = []; // no papers/patents/milestones for this company at all
    const snapshot: CompanySnapshot = { symbol: "IONQ", name: "IonQ", marketCapUsd: 1e9, asOf: "2026-01-01", url: "https://ionq.com" };
    const idx = buildOrgFinancialIndex({ companies: [snapshot] });
    const result = resolveOrgProfile(entries, idx, canonicalizeOrg("IonQ").id);
    expect(result.status).toBe("financial-only");
    if (result.status === "financial-only") {
      expect(result.hasTicker).toBe(true);
      expect(result.name).toBe("IonQ");
    }
  });

  it("resolves a VC-only company (no entries, no ticker) via orgIdToVc", () => {
    const entries: Entry[] = [];
    const vc: VcCompanyFunding = { orgId: "999", name: "Quantinuum", totalRaisedUsd: 1_100_000_000, dealCount: 2, deals: [] };
    const idx = buildOrgFinancialIndex({ vcFunding: [vc] });
    const result = resolveOrgProfile(entries, idx, canonicalizeOrg("Quantinuum").id);
    expect(result.status).toBe("financial-only");
    if (result.status === "financial-only") expect(result.hasVc).toBe(true);
  });

  it("falls back to a real fuzzy-match search over entries when neither entries nor financial data resolve by id — never a bare dead end when the raw label genuinely appears in tracked records", () => {
    // Real scenario this guards against: a company renamed between two
    // data sources so its canonical id differs, but the ORIGINAL label the
    // user clicked still appears verbatim in some entry's raw org field.
    const entries = [makeEntry({ id: "e1", org: "Acme Quantum Labs, Inc." })];
    const idx = buildOrgFinancialIndex({});
    const result = resolveOrgProfile(entries, idx, "some-stale-id-that-matches-nothing", "Acme Quantum Labs");
    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") {
      expect(result.fuzzyMatches.length).toBe(1);
      expect(result.fuzzyMatches[0].org).toContain("Acme Quantum Labs");
    }
  });

  it("returns a real, empty-but-honest unresolved state when truly nothing matches (no fabricated match)", () => {
    const entries = [makeEntry({ id: "e1", org: "IBM" })];
    const idx = buildOrgFinancialIndex({});
    const result = resolveOrgProfile(entries, idx, "totally-unknown-id", "Totally Unknown Company");
    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") expect(result.fuzzyMatches.length).toBe(0);
  });
});

describe("DrawerTarget URL round-trip — every kind serializes and parses back to the same value", () => {
  const cases: DrawerTarget[] = [
    { kind: "country", code: "US" },
    { kind: "org", orgId: "nvidia" },
    { kind: "org", orgId: "nvidia", label: "NVIDIA Corp." },
    { kind: "investor", name: "Sequoia Capital" },
    { kind: "entry", id: "oa-W123456" },
    { kind: "collaboration", a: "CN", b: "US" },
    { kind: "sankeyLink", investor: "Sequoia Capital", companyId: "openai" },
    { kind: "researchFlowLink", source: "US", target: "ibm" },
  ];
  for (const target of cases) {
    it(`round-trips ${JSON.stringify(target)}`, () => {
      const serialized = serializeDrawerTarget(target);
      expect(parseDrawerTarget(serialized)).toEqual(target);
    });
  }

  it("parses a malformed/unknown value to null instead of throwing", () => {
    expect(parseDrawerTarget("garbage")).toBeNull();
    expect(parseDrawerTarget("org:")).toBeNull();
    expect(parseDrawerTarget(null)).toBeNull();
  });
});

describe("technology slug mapping", () => {
  it("maps a real vertical id to its short slug and back", () => {
    const slug = technologySlug("quantum-computing");
    expect(slug).toBe("quantum");
    expect(verticalIdFromSlug(slug)).toBe("quantum-computing");
    expect(verticalIdFromSlug("ai")).toBe("artificial-intelligence");
  });

  it("returns null for an unrecognized slug rather than guessing", () => {
    expect(verticalIdFromSlug("not-a-real-technology")).toBeNull();
  });
});

describe("URL state read/write — dashboard/technology namespacing and old-link migration", () => {
  function withUrl<T>(search: string, fn: () => T): T {
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window: unknown }).window = {
      location: { search, pathname: "/global-tech-monitor/", hash: "" },
      history: { replaceState: () => {}, pushState: () => {} },
    };
    try {
      return fn();
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }

  it("reads technology+dashboard directly when present", () => {
    withUrl("?technology=ai&dashboard=money", () => {
      const s = readUrlState();
      expect(s.technology).toBe("artificial-intelligence");
      expect(s.dashboard).toBe("money");
    });
  });

  it("migrates a bare mode=explore with no other hint to Overview", () => {
    withUrl("?mode=explore", () => {
      expect(readUrlState().dashboard).toBe("overview");
    });
  });

  it("migrates old stage=investment state to the Money dashboard", () => {
    withUrl("?mode=explore&stage=investment", () => {
      expect(readUrlState().dashboard).toBe("money");
    });
  });

  it("migrates old stage=innovation state to the Research dashboard", () => {
    withUrl("?mode=explore&stage=innovation", () => {
      expect(readUrlState().dashboard).toBe("research");
    });
  });

  it("migrates leftover sankeyMeasure state to the Money dashboard even without an explicit stage", () => {
    withUrl("?mode=explore&sankeyMeasure=amount", () => {
      expect(readUrlState().dashboard).toBe("money");
    });
  });

  it("writeUrlState never leaves a stale mode= param behind", () => {
    withUrl("?mode=explore&stage=innovation", () => {
      let written = "";
      (window as unknown as { history: { replaceState: (s: unknown, t: string, url: string) => void } }).history.replaceState = (_s, _t, url) => { written = url; };
      writeUrlState({ dashboard: "research" });
      expect(written).not.toContain("mode=");
    });
  });
});
