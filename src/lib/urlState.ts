import type { Stage } from "./types.ts";
import { parseDrawerTarget, serializeDrawerTarget, type DrawerTarget } from "./drawerTarget.ts";
import { codeFromCountryName, countryName } from "./countries.ts";

export interface UrlState {
  mode: "story" | "explore";
  compareCountries: string[]; // alpha-2 codes, internally
  country: string | "all"; // the single hard filter
  stage: Stage | "all";
  from: string | null; // ISO date
  to: string | null; // ISO date
  record: DrawerTarget | null;
  sankeyMeasure: "count" | "amount";
}

const VALID_STAGES = new Set<Stage>(["innovation", "scaling", "adoption", "investment"]);

// Country codes are the internal representation everywhere in this app
// (CLAUDE.md is explicit about this), but a shared URL should read like
// ?countries=china,india, not ?countries=CN,IN — codeFromCountryName/
// countryName (countries.ts) bridge the two directions.
function parseCountryList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => codeFromCountryName(s) ?? s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 4);
}

export function readUrlState(): UrlState {
  const p = new URLSearchParams(window.location.search);
  const mode = p.get("mode") === "explore" ? "explore" : "story";
  const compareCountries = parseCountryList(p.get("countries"));
  const countryRaw = p.get("country");
  const country = countryRaw ? codeFromCountryName(countryRaw) ?? countryRaw.toUpperCase() : "all";
  const stageRaw = p.get("stage") as Stage | null;
  const stage = stageRaw && VALID_STAGES.has(stageRaw) ? stageRaw : "all";
  const from = p.get("from");
  const to = p.get("to");
  const record = parseDrawerTarget(p.get("record"));
  const sankeyMeasure = p.get("sankeyMeasure") === "amount" ? "amount" : "count";
  return { mode, compareCountries, country, stage, from, to, record, sankeyMeasure };
}

// Writes only the keys present in `patch` — every other real query param
// (including ones this app doesn't know about) is left untouched, so this
// composes cleanly with itself across many independent state changes
// instead of clobbering the whole query string each time. Uses
// replaceState, not pushState — a filter/selection change isn't real page
// navigation, so it shouldn't pile up back-button entries.
export function writeUrlState(patch: Partial<UrlState>) {
  const p = new URLSearchParams(window.location.search);
  const set = (key: string, value: string | null) => {
    if (value) p.set(key, value);
    else p.delete(key);
  };
  if ("mode" in patch) set("mode", patch.mode === "explore" ? "explore" : null);
  if ("compareCountries" in patch) {
    set("countries", patch.compareCountries?.length ? patch.compareCountries.map((c) => countryName(c).toLowerCase()).join(",") : null);
  }
  if ("country" in patch) set("country", patch.country && patch.country !== "all" ? countryName(patch.country).toLowerCase() : null);
  if ("stage" in patch) set("stage", patch.stage && patch.stage !== "all" ? patch.stage : null);
  if ("from" in patch) set("from", patch.from ?? null);
  if ("to" in patch) set("to", patch.to ?? null);
  if ("record" in patch) set("record", serializeDrawerTarget(patch.record));
  if ("sankeyMeasure" in patch) set("sankeyMeasure", patch.sankeyMeasure === "amount" ? "amount" : null);
  const query = p.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", url);
}
