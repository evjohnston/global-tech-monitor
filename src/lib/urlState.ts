import type { Stage } from "./types.ts";
import { VERTICALS } from "./verticals.ts";
import { parseDrawerTarget, serializeDrawerTarget, type DrawerTarget } from "./drawerTarget.ts";
import { codeFromCountryName, countryName } from "./countries.ts";

export type Dashboard = "overview" | "research" | "scaling" | "adoption" | "money";
const VALID_DASHBOARDS = new Set<Dashboard>(["overview", "research", "scaling", "adoption", "money"]);
const STAGE_TO_DASHBOARD: Record<Stage, Dashboard> = { innovation: "research", scaling: "scaling", adoption: "adoption", investment: "money" };

// A vertical's URL slug is just its shortLabel lowercased ("Quantum" ->
// "quantum", "AI" -> "ai") — no separate hand-maintained map needed, and it
// matches this app's real vertical labels rather than an arbitrary scheme.
export function technologySlug(verticalId: string): string {
  const v = VERTICALS.find((v) => v.id === verticalId);
  return v ? v.shortLabel.toLowerCase() : verticalId;
}
export function verticalIdFromSlug(slug: string): string | null {
  const v = VERTICALS.find((v) => v.shortLabel.toLowerCase() === slug.toLowerCase() || v.id === slug);
  return v?.id ?? null;
}

export interface UrlState {
  technology: string | null; // resolved vertical id, or null to use the default
  dashboard: Dashboard;
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

// Resolves which dashboard a URL means, including the pre-dashboard-nav
// `mode=story`/`mode=explore` scheme this replaces (see CLAUDE.md/session
// notes — Story became Overview, Explore's content was distributed across
// the 4 Track dashboards). A bare `mode=explore` with no other hint maps to
// Overview (the safe default); real hints in the OLD state (a stage filter,
// or leftover Sankey state) route to the specific dashboard that state was
// actually about, per the migration mapping this was built against.
function resolveDashboard(p: URLSearchParams): Dashboard {
  const explicit = p.get("dashboard") as Dashboard | null;
  if (explicit && VALID_DASHBOARDS.has(explicit)) return explicit;
  if (p.has("sankeyMeasure") || p.get("stage") === "investment") return "money";
  const stageRaw = p.get("stage") as Stage | null;
  if (stageRaw && VALID_STAGES.has(stageRaw)) return STAGE_TO_DASHBOARD[stageRaw];
  return "overview";
}

export function readUrlState(): UrlState {
  const p = new URLSearchParams(window.location.search);
  const techRaw = p.get("technology");
  const technology = techRaw ? verticalIdFromSlug(techRaw) : null;
  const dashboard = resolveDashboard(p);
  const compareCountries = parseCountryList(p.get("countries"));
  const countryRaw = p.get("country");
  const country = countryRaw ? codeFromCountryName(countryRaw) ?? countryRaw.toUpperCase() : "all";
  const stageRaw = p.get("stage") as Stage | null;
  const stage = stageRaw && VALID_STAGES.has(stageRaw) ? stageRaw : "all";
  const from = p.get("from");
  const to = p.get("to");
  const record = parseDrawerTarget(p.get("record"));
  const sankeyMeasure = p.get("sankeyMeasure") === "amount" ? "amount" : "count";
  return { technology, dashboard, compareCountries, country, stage, from, to, record, sankeyMeasure };
}

// Writes only the keys present in `patch` — every other real query param
// (including ones this app doesn't know about) is left untouched, so this
// composes cleanly with itself across many independent state changes
// instead of clobbering the whole query string each time. Uses
// replaceState, not pushState for most updates — a filter/selection change
// isn't real page navigation — but see App.tsx's navigate() for the one
// case (dashboard/technology switches) that DOES use pushState so back/
// forward moves between dashboards, per the "browser back/forward must
// restore the correct state" requirement.
export function writeUrlState(patch: Partial<UrlState>, opts: { push?: boolean } = {}) {
  const p = new URLSearchParams(window.location.search);
  const set = (key: string, value: string | null) => {
    if (value) p.set(key, value);
    else p.delete(key);
  };
  if ("technology" in patch) set("technology", patch.technology ? technologySlug(patch.technology) : null);
  if ("dashboard" in patch) set("dashboard", patch.dashboard && patch.dashboard !== "overview" ? patch.dashboard : null);
  // mode= is the deprecated pre-dashboard-nav param — always stripped once
  // we've resolved and written a real dashboard, so a shared old-style link
  // converts to the new scheme instead of carrying dead state forever.
  p.delete("mode");
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
  if (opts.push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}
