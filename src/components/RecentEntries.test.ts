import { describe, it, expect } from "vitest";
import type { Entry } from "../lib/types.ts";
import { byRecency } from "./RecentEntries.tsx";

const TODAY = "2026-09-04";
const at = (id: string, date: string, source: Entry["source"] = "paper"): Entry => ({
  id, stage: "innovation", country: "US", provenance: "live", source,
  title: id, org: "Org", date, url: "https://example.com",
});
const order = (es: Entry[]) => [...es].sort(byRecency(TODAY)).map((e) => e.id);

// Found by auditing the shipped data on 2026-09-04. This panel answers "what
// is newest", and it was leading with things that had not happened:
// biotechnology's top row was a Zenodo dataset dated 2027-02-23 — six months
// out, an upstream metadata error — above that day's real Watchmaker Genomics
// and ZymoChem news. AI's top row was a 2027-01-01 AAAI conference paper.
describe("RecentEntries ordering does not present the future as the newest", () => {
  it("ranks a real entry from today above a future-dated one", () => {
    const es = [at("future", "2027-02-23"), at("today", TODAY, "milestone")];
    expect(order(es)[0]).toBe("today");
  });

  // Clamping alone was not enough, and this is the case that proved it: the
  // future entry ties with today, and a stable sort then left it first.
  it("keeps future entries behind today's even when they were listed first", () => {
    const es = [at("f1", "2027-01-01"), at("f2", "2026-10-01"), at("real", TODAY)];
    expect(order(es)[0]).toBe("real");
  });

  it("still orders ordinary dates newest first", () => {
    const es = [at("old", "2026-01-01"), at("mid", "2026-06-01"), at("new", "2026-09-01")];
    expect(order(es)).toEqual(["new", "mid", "old"]);
  });

  // Clamped rather than filtered, because some future dates are correct:
  // journals assign forward issue dates, and NSF grants and federal
  // contracts are awarded before they start. Three such entries were in the
  // live data and all three were right, so hiding them would lose real
  // records.
  it("keeps future-dated entries in the list rather than dropping them", () => {
    const es = [at("grant", "2026-10-01", "grant"), at("real", TODAY)];
    expect(order(es)).toHaveLength(2);
    expect(order(es)).toContain("grant");
  });

  it("does not throw or lose entries when everything is future-dated", () => {
    const es = [at("far", "2027-06-01"), at("near", "2026-09-20")];
    expect(order(es)).toHaveLength(2);
  });

  it("is a total order, returning 0 on a genuine tie", () => {
    expect(byRecency(TODAY)(at("a", TODAY), at("b", TODAY))).toBe(0);
  });
});
