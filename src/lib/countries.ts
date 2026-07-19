// Country reference data — ISO 3166-1 alpha-2 codes, names, and the numeric
// IDs the world-atlas topojson keys its geometry by. Thin wrapper around
// i18n-iso-countries rather than a hand-maintained table.
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return countries.getName(code, "en") ?? code;
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

// Color budget: US and China are the app's headline comparison (see
// CLAUDE.md — "who leads, US vs China" is the framing). Every other real
// country gets the same neutral tone; the country code/name text is what
// distinguishes them, not a unique hue. Do not add per-country colors —
// that doesn't scale past ~4 and defeats the point of a disciplined palette.
export function countryColor(code: string | null | undefined): string {
  if (code === "US") return "var(--us)";
  if (code === "CN") return "var(--cn)";
  if (!code) return "var(--mist)";
  return "var(--other)";
}
