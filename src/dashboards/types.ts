import type { DataFile, Entry, Stage, StageNote, TrendPoint } from "../lib/types.ts";
import type { VerticalConfig } from "../lib/verticals.ts";
import type { OrgFinancialIndex } from "../lib/orgFinancials.ts";
import type { DrawerTarget } from "../lib/drawerTarget.ts";
import type { Dashboard } from "../lib/urlState.ts";
import type { ChangeLogItem } from "../lib/changeLog.ts";
import type { FindingCard } from "../lib/findings.ts";

// One shared bundle every dashboard reads from — computation stays
// centralized in App.tsx (one fetch, one cache, one set of aggregates), the
// five dashboard components are pure render + their own dashboard-specific
// derived data. Avoids threading 30 individual props through each file.
export interface DashboardContext {
  vertical: VerticalConfig;
  data: DataFile | null;
  entries: Entry[]; // the vertical's full corpus, unfiltered
  shown: Entry[]; // entries after country/stage/date-range filters
  byStage: Record<Stage, Entry[]>; // `shown`, grouped by stage
  trend: TrendPoint[];
  trend21: TrendPoint[];
  latestNote: Partial<Record<Stage, StageNote>>;
  orgFinancialIndex: OrgFinancialIndex;
  symbolToCompanyName: Map<string, string>;

  // shared filters (section 9) — technology-namespaced by virtue of living
  // in App.tsx state that fully resets on vertical switch
  country: string | "all";
  stage: Stage | "all";
  dateRange: { from: string | null; to: string | null };
  compareCountries: string[];
  highlightOrg: string | null;

  dark: boolean;
  generated: string;
  updatedAgo: string | null;

  // navigation
  dashboard: Dashboard;
  navigate: (dashboard: Dashboard, opts?: { country?: string; stage?: Stage }) => void;

  // shared handlers
  toggleCountry: (c: string) => void;
  toggleStage: (s: Stage) => void;
  toggleCompareCountry: (c: string) => void;
  filterToCountry: (c: string) => void;
  clearCountryFilter: () => void;
  openTarget: (t: DrawerTarget) => void;
  openCountryProfile: (c: string) => void;
  openOrgDrawer: (org: string) => void;
  openOrgDrawerBySymbol: (symbol: string) => void;
  openEntryDrawer: (entry: Entry) => void;
  highlightOrgInPipeline: (org: string) => void;
  setHighlightOrg: (org: string | null) => void;
  setRecordExplorerStage: (s: Stage | null) => void;
  activateFinding: (card: FindingCard) => void;
  activateChangeLogItem: (item: ChangeLogItem) => void;
  clearAllSelections: () => void;
  copySelectionLink: () => void;

  // Track Money specific, lifted here since the Overview matrix also reads it
  sankeyMeasure: "count" | "amount";
  setSankeyMeasure: (m: "count" | "amount") => void;
}
