import { describe, it, expect } from "vitest";
import { countryName, codeFromCountryName } from "./countries.ts";

// Every code that actually appears in live data, taken from the shipped AI
// and biotechnology files on 2026-09-03 — 144 of them. Kept as a literal
// rather than derived, so this test is a fixed check on real observed
// coverage rather than a tautology against whatever the data happens to
// hold today.
const LIVE_CODES =
  "AE AL AM AR AT AU AZ BA BD BE BF BG BH BJ BO BR BW BY CA CD CG CH CI CL CM CN CO CR CU CW CY CZ DE DK DO DZ EC EE EG ES ET FI FR GB GD GE GF GH GR HK HR HU ID IE IL IN IQ IR IS IT JO JP KE KG KH KN KP KR KW KY KZ LA LB LC LK LT LU LV LY MA MC MD MK MM MN MO MR MT MV MX MY MZ NG NI NL NO NP NZ OM PA PE PG PH PK PL PR PS PT PY QA RO RS RU RW SA SD SE SG SI SK SL SN SO SX SY TH TJ TN TR TT TW TZ UA UG US UY UZ VE VN XK YE ZA ZM ZW".split(
    " ",
  );

describe("countryName — a policy reader sees names, never codes or political labels", () => {
  // CLAUDE.md: "Display uses full country names (countryName()), never the
  // raw alpha-2 code — a page full of two-letter codes reads like a data
  // table, not an instrument." A code falling through is the failure.
  it("resolves every country code present in live data to a real name", () => {
    const unresolved = LIVE_CODES.filter((c) => countryName(c) === c);
    expect(unresolved).toEqual([]);
  });

  // The reason COMMON_NAME exists. ISO 3166-1's English name for TW is
  // "Taiwan, Province of China", which this app rendered in every badge,
  // tooltip, bar label and map hover until 2026-09-03 — a contested
  // political claim asserted by an instrument built to compare national
  // technology capability, and one whose own ticker lists include TSMC.
  // Same call already made for CN, which ISO calls "People's Republic of
  // China". If a future change drops COMMON_NAME to "simplify", this fails.
  it("does not render ISO's political or formal constructions", () => {
    expect(countryName("TW")).toBe("Taiwan");
    expect(countryName("CN")).toBe("China");
    expect(countryName("IR")).toBe("Iran");
    expect(countryName("SY")).toBe("Syria");
    expect(countryName("PS")).toBe("Palestine");
    for (const c of LIVE_CODES)
      expect(countryName(c)).not.toMatch(/Province of|Islamic Republic|Arab Republic|Democratic People|Plurinational|Bolivarian|\(/);
  });

  // CD is "DR Congo" and CG is "Republic of the Congo". Shortening CG to
  // "Congo" would make the pair ambiguous, so it is deliberately left long.
  it("keeps the two Congos distinguishable", () => {
    expect(countryName("CD")).not.toBe(countryName("CG"));
    expect(countryName("CD")).toBe("DR Congo");
  });

  it("has no name collisions across live codes", () => {
    const names = LIVE_CODES.map(countryName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("reports a missing country as Unknown rather than an empty string", () => {
    expect(countryName(null)).toBe("Unknown");
    expect(countryName(undefined)).toBe("Unknown");
  });
});

describe("codeFromCountryName — shared links survive a rename", () => {
  it("round-trips every live code through its display name", () => {
    const broken = LIVE_CODES.filter((c) => codeFromCountryName(countryName(c)) !== c);
    expect(broken).toEqual([]);
  });

  // A ?countries=... link shared before the 2026-09-03 rename still carries
  // ISO's long name. Those links must keep working — i18n-iso-countries'
  // own matcher still knows the formal names, so both spellings resolve.
  it("still resolves the ISO names that COMMON_NAME replaced", () => {
    expect(codeFromCountryName("Taiwan, Province of China")).toBe("TW");
    expect(codeFromCountryName("Islamic Republic of Iran")).toBe("IR");
    expect(codeFromCountryName("Syrian Arab Republic")).toBe("SY");
    expect(codeFromCountryName("State of Palestine")).toBe("PS");
    expect(codeFromCountryName("People's Republic of China")).toBe("CN");
  });

  it("is case-insensitive, since a URL is typed by hand", () => {
    expect(codeFromCountryName("taiwan")).toBe("TW");
    expect(codeFromCountryName("CHINA")).toBe("CN");
  });

  it("returns null for a non-country rather than guessing", () => {
    expect(codeFromCountryName("")).toBeNull();
    expect(codeFromCountryName("not a country")).toBeNull();
  });
});
