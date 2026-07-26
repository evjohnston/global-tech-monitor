// Country reference data — ISO 3166-1 alpha-2 codes, names, and the numeric
// IDs the world-atlas topojson keys its geometry by. Thin wrapper around
// i18n-iso-countries rather than a hand-maintained table.
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import { CONTINENT_BY_CODE } from "./continentMap.ts";

countries.registerLocale(en);

// Continent lookup, keyed by alpha-2. CONTINENT_BY_CODE is generated (not
// hand-typed) by scripts/gen-continent-map.ts from the world-countries
// package's region/subregion fields — see that script for why it's a
// generated static file rather than importing world-countries directly here:
// that package carries every field for 250 countries, and importing the
// whole thing into this (client-bundled) module cost 250KB+ of dead weight
// for one field. "Americas" splits into North and South by subregion;
// Central America + the Caribbean fold into North America, the standard
// 7-continent grouping.
export type Continent = "north-america" | "south-america" | "europe" | "asia" | "africa" | "oceania" | "middle-east";

export function continentOf(code: string | null | undefined): Continent | null {
  if (!code) return null;
  return CONTINENT_BY_CODE[code] ?? null;
}

// A handful of ISO short names are their full formal/political name, which
// reads oddly repeated on every badge in a dense list (e.g. "People's
// Republic of China," "Lao People's Democratic Republic"). Override with
// the name people actually use in conversation; everything else uses the
// ISO name as-is rather than hand-maintaining a full table.
const COMMON_NAME: Record<string, string> = {
  US: "United States", CN: "China", RU: "Russia", LA: "Laos",
  CD: "DR Congo", TZ: "Tanzania", VA: "Vatican City",
  FM: "Micronesia", BN: "Brunei", CI: "Ivory Coast",
};

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return COMMON_NAME[code] ?? countries.getName(code, "en") ?? code;
}

const COMMON_NAME_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(COMMON_NAME).map(([code, name]) => [name.toLowerCase(), code])
);

// Reverse of countryName() — a human-readable name (as typed into a URL's
// ?countries=china,india, or read back out of one) to the real alpha-2 code
// every other lookup in this app keys off. i18n-iso-countries' own fuzzy
// name matching handles most cases; COMMON_NAME_REVERSE covers the same
// handful this file already overrides for display (e.g. "china" rather
// than "People's Republic of China").
export function codeFromCountryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (COMMON_NAME_REVERSE[lower]) return COMMON_NAME_REVERSE[lower];
  return countries.getAlpha2Code(trimmed, "en") ?? null;
}

// world-atlas / Natural Earth topojson keys each country feature by its ISO
// 3166-1 NUMERIC code (e.g. "840" for US), not the alpha-2 code every data
// source in this app uses. This is the bridge between the two.
export function countryNumericId(code: string | null | undefined): string | null {
  if (!code) return null;
  return countries.alpha2ToNumeric(code) ?? null;
}

// Reverse of the above — topojson feature.id (numeric) back to the alpha-2
// code every real Entry is keyed by, so the map can look up real counts.
export function alpha2FromNumeric(numericId: string | undefined): string | null {
  if (!numericId) return null;
  return countries.numericToAlpha2(numericId) ?? null;
}

// v4's continent-based color map (CONTINENT_COLOR) was removed 2026-07-25
// when country color reverted to the named-actor scheme below — see
// countryColor(). continentOf()/Continent stay exported; the --cont-*
// tokens stay in index.css as an unused-but-documented fallback palette.

// v5 country color (2026-07-25, reverted from v4's continent scheme at
// explicit user request): a fixed identity for the handful of actors a
// policy reader tracks by name — US, China, India, and the EU/Germany
// bloc — so a chart reads "which side is which" without hovering.
// Everything else gets one restrained neutral, not more decorative
// variety; this is deliberately a SMALL, named set, not a full per-
// country palette. EU_COUNTRIES is the real 27 member states (not every
// European country — the UK, Norway, Switzerland etc. fall through to
// --country-other, same as any non-named country).
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export function countryColor(code: string | null | undefined): string {
  if (!code) return "var(--country-other)";
  if (code === "US") return "var(--country-us)";
  if (code === "CN") return "var(--country-cn)";
  if (code === "IN") return "var(--country-in)";
  if (EU_COUNTRIES.has(code)) return "var(--country-eu)";
  return "var(--country-other)";
}
