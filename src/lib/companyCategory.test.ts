import { describe, it, expect } from "vitest";
import { VERTICALS } from "./verticals.ts";
import { tickerProfile, rdSectorsFor, RD_SECTOR_LABEL } from "./companyCategory.ts";

describe("tickerProfile — an uncategorized company must not be counted as a categorized one", () => {
  // The bug this locks down. The fallback used to return
  // `sector: "software-platforms"` alongside an evidence string reading
  // "Not yet individually categorized" — prose declining to classify while
  // the sector asserted one. TrackMoney filters the R&D breakdown on
  // `sector === rdSector`, so in quantum and AI an unregistered ticker's
  // entire company-wide R&D budget landed under "Software and platforms",
  // silently, from the moment anyone added a ticker to verticals.ts without
  // touching companyCategory.ts.
  it("never falls back to a real sector", () => {
    const p = tickerProfile("quantum-computing", "NOT_A_REAL_TICKER");
    expect(p.sector).toBe("uncategorized");
    expect(p.sector).not.toBe("software-platforms");
  });

  it("falls back for an unknown vertical too, rather than borrowing another's map", () => {
    expect(tickerProfile("no-such-vertical", "IBM").sector).toBe("uncategorized");
  });

  it("categorizes every ticker in every registered vertical", () => {
    const gaps: string[] = [];
    for (const v of VERTICALS)
      for (const t of v.tickers)
        if (tickerProfile(v.id, t).sector === "uncategorized") gaps.push(`${v.id}/${t}`);
    expect(gaps).toEqual([]);
  });
});

describe("rdSectorsFor — the chip row reflects what is actually being rendered", () => {
  it("offers only sectors a vertical really uses", () => {
    const space = rdSectorsFor("space");
    expect(space).toContain("space-launch");
    expect(space).not.toContain("biotech-therapeutics");
    expect(space[0]).toBe("all");
  });

  it("adds the uncategorized chip only when such a company is present", () => {
    expect(rdSectorsFor("space", ["RKLB", "LMT"])).not.toContain("uncategorized");
    expect(rdSectorsFor("space", ["RKLB", "MYSTERY"])).toContain("uncategorized");
  });

  it("stays unchanged when no symbols are passed, so existing callers are unaffected", () => {
    expect(rdSectorsFor("space", undefined)).toEqual(rdSectorsFor("space"));
  });

  it("has a label for every sector it can return", () => {
    for (const v of VERTICALS)
      for (const s of rdSectorsFor(v.id, ["MYSTERY"]))
        expect(RD_SECTOR_LABEL[s], `missing label for ${s}`).toBeTruthy();
  });
});
