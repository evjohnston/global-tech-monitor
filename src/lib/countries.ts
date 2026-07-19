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

// Color budget, v4: every country is colored by its continent (six tones,
// see --cont-* tokens in index.css) rather than a US/China-vs-everyone-else
// split — a deliberate change from the earlier two-brand-color scheme.
// Hoover Red (--red) stays reserved for the single UI accent (KPI highlight,
// primary button) and is not reused here, so continent color never reads as
// "the brand color" on a country that happens to be in Asia.
const CONTINENT_COLOR: Record<Continent, string> = {
  "north-america": "var(--cont-na)",
  "south-america": "var(--cont-sa)",
  europe: "var(--cont-eu)",
  asia: "var(--cont-as)",
  africa: "var(--cont-af)",
  oceania: "var(--cont-oc)",
  "middle-east": "var(--cont-me)",
};

export function countryColor(code: string | null | undefined): string {
  const cont = continentOf(code);
  return cont ? CONTINENT_COLOR[cont] : "var(--mist)";
}
