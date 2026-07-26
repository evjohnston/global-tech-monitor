import { useEffect, useMemo, useRef, useState } from "react";
import type { DataFile, Entry, Stage, StageNote } from "./lib/types.ts";
import { VERTICALS } from "./lib/verticals.ts";
import { countryName } from "./lib/countries.ts";
import { buildOrgFinancialIndex } from "./lib/orgFinancials.ts";
import { canonicalizeOrg } from "./lib/entityResolution.ts";
import type { DrawerTarget } from "./lib/drawerTarget.ts";
import { readUrlState, writeUrlState, type Dashboard } from "./lib/urlState.ts";
import type { FindingCard } from "./lib/findings.ts";
import type { ChangeLogItem } from "./lib/changeLog.ts";
import type { DashboardContext } from "./dashboards/types.ts";
import { Overview } from "./dashboards/Overview.tsx";
import { TrackResearch } from "./dashboards/TrackResearch.tsx";
import { TrackScaling } from "./dashboards/TrackScaling.tsx";
import { TrackAdoption } from "./dashboards/TrackAdoption.tsx";
import { TrackMoney } from "./dashboards/TrackMoney.tsx";
import { NewsTicker } from "./components/NewsTicker.tsx";
import { MetadataDrawer } from "./components/MetadataDrawer.tsx";
import { RecordExplorer } from "./components/RecordExplorer.tsx";
import { DashboardNavigation } from "./components/DashboardNavigation.tsx";
import { DashboardFilters } from "./components/DashboardFilters.tsx";
import { ExpandableMethods } from "./components/ChartFrame.tsx";
import logoLightBg from "./assets/logos/logo-light-bg.png";
import logoDarkBg from "./assets/logos/logo-dark-bg.png";

// Static-store-only (2026-07-20): the frontend reads whichever
// public/data/<vertical>.json the nightly build last wrote and nothing
// else — see CLAUDE.md's "Live data" section for why. scripts/fetch-data.ts
// is the one real ingestion pipeline; nothing here calls a live source.
type LiveMode = "loading" | "static" | "fallback";

export default function App() {
  // Technology + dashboard are both real URL state now (?technology=quantum
  // &dashboard=overview) — replaces the old mode=story/explore toggle.
  // readUrlState() also migrates a shared old-style link (mode=explore,
  // a stray stage=investment, etc.) onto the closest real dashboard.
  const initialUrlState = useRef(readUrlState()).current;
  const [verticalId, setVerticalId] = useState(initialUrlState.technology ?? VERTICALS[0].id);
  const vertical = VERTICALS.find((v) => v.id === verticalId) ?? VERTICALS[0];
  const [dashboard, setDashboard] = useState<Dashboard>(initialUrlState.dashboard);
  const [data, setData] = useState<DataFile | null>(null);
  const [country, setCountry] = useState<string | "all">(initialUrlState.country);
  const [stage, setStage] = useState<Stage | "all">(initialUrlState.stage);
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({ from: initialUrlState.from, to: initialUrlState.to });
  const [mode, setMode] = useState<LiveMode>("loading");
  const [highlightOrg, setHighlightOrg] = useState<string | null>(null);
  const [compareCountries, setCompareCountries] = useState<string[]>(initialUrlState.compareCountries);
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(initialUrlState.record);
  const [sankeyMeasure, setSankeyMeasure] = useState<"count" | "amount">(initialUrlState.sankeyMeasure);
  const [recordExplorerStage, setRecordExplorerStage] = useState<Stage | null>(null);
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("gtm-theme");
    if (saved === "dark" || saved === "light") return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [nowTick, setNowTick] = useState(0);
  const dataCacheRef = useRef<Record<string, DataFile>>({});

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("gtm-theme", dark ? "dark" : "light");
  }, [dark]);

  // Keeps every selection shareable and namespaced by technology+dashboard —
  // a reader can copy the URL and reload the exact same view. replaceState
  // for filter/selection changes (not real navigation); navigate() below
  // uses pushState for dashboard/technology switches specifically, so
  // browser back/forward moves between dashboards as expected.
  useEffect(() => {
    writeUrlState({ technology: verticalId, dashboard, compareCountries, country, stage, from: dateRange.from, to: dateRange.to, record: drawerTarget, sankeyMeasure });
  }, [verticalId, dashboard, compareCountries, country, stage, dateRange, drawerTarget, sankeyMeasure]);

  // Browser back/forward restores dashboard + technology (and everything
  // else readUrlState resolves) from whatever the URL now says.
  useEffect(() => {
    function onPopState() {
      const s = readUrlState();
      if (s.technology) setVerticalId(s.technology);
      setDashboard(s.dashboard);
      setCountry(s.country);
      setStage(s.stage);
      setDateRange({ from: s.from, to: s.to });
      setCompareCountries(s.compareCountries);
      setDrawerTarget(s.record);
      setSankeyMeasure(s.sankeyMeasure);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cached = dataCacheRef.current[vertical.id];
    setData(cached ?? null);
    setMode(cached ? "static" : "loading");
    // A technology switch is a FULL reset of every technology-scoped
    // selection — sankeyMeasure, compareCountries, country, stage, date
    // range, and the pinned drawer all reset, so nothing (e.g. a Quantum
    // Track Money sankeyMeasure=amount) leaks into AI Overview. Dashboard
    // itself is intentionally NOT reset here — switching technology keeps
    // you on the same dashboard, just for the other technology.
    setCountry("all");
    setStage("all");
    setDateRange({ from: null, to: null });
    setDrawerTarget(null);
    setHighlightOrg(null);
    setCompareCountries([]);
    setSankeyMeasure("count");
    const dataUrl = `${import.meta.env.BASE_URL}data/${vertical.id}.json`;
    fetch(dataUrl)
      .then((r) => r.json() as Promise<DataFile>)
      .then((d) => {
        dataCacheRef.current[vertical.id] = d;
        setData(d);
        setMode("static");
      })
      .catch(() => { if (!cached) setMode("fallback"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical.id]);

  const entries = data?.entries ?? [];
  const trend = data?.trend ?? [];
  const trend21 = useMemo(() => trend.slice(-21), [trend]);
  const shown = useMemo(
    () =>
      entries.filter(
        (e) =>
          (country === "all" || e.country === country) &&
          (stage === "all" || e.stage === stage) &&
          (!dateRange.from || !e.date || e.date >= dateRange.from) &&
          (!dateRange.to || !e.date || e.date <= dateRange.to)
      ),
    [entries, country, stage, dateRange]
  );
  const byStage = useMemo(() => {
    const by: Record<Stage, Entry[]> = { innovation: [], scaling: [], adoption: [], investment: [] };
    for (const e of shown) by[e.stage].push(e);
    for (const s of Object.keys(by) as Stage[]) by[s].sort((a, b) => (a.date < b.date ? 1 : -1));
    return by;
  }, [shown]);
  const latestNote = useMemo(() => {
    const by: Partial<Record<Stage, StageNote>> = {};
    for (const n of data?.notes ?? []) { const c = by[n.stage]; if (!c || n.date > c.date) by[n.stage] = n; }
    return by;
  }, [data]);

  const orgFinancialIndex = useMemo(() => buildOrgFinancialIndex(data ?? {}), [data]);
  const symbolToCompanyName = useMemo(() => new Map((data?.companies ?? []).map((c) => [c.symbol, c.name])), [data]);

  const generated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const statusText = mode === "loading" ? "loading" : mode === "fallback" ? "data unavailable" : "static build";
  const updatedAgo = (() => {
    if (!data?.generatedAt) return null;
    void nowTick;
    const secs = Math.max(0, Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 1000));
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  })();

  // ── shared handlers ────────────────────────────────────────────────
  function navigate(nextDashboard: Dashboard, opts?: { country?: string; stage?: Stage }) {
    setDashboard(nextDashboard);
    if (opts?.country) setCountry(opts.country);
    if (opts?.stage) setStage(opts.stage);
    writeUrlState({ dashboard: nextDashboard, ...(opts?.country ? { country: opts.country } : {}) }, { push: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function switchTechnology(id: string) {
    setVerticalId(id);
    writeUrlState({ technology: id }, { push: true });
  }
  function toggleCountry(c: string) {
    setCountry((prev) => (prev === c ? "all" : c));
  }
  function toggleStage(s: Stage) {
    setStage((prev) => (prev === s ? "all" : s));
  }
  function toggleCompareCountry(c: string) {
    setCompareCountries((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= 4) return prev;
      return [...prev, c];
    });
  }
  function filterToCountry(c: string) {
    setCountry(c);
  }
  function clearCountryFilter() {
    setCountry("all");
  }
  function openTarget(t: DrawerTarget) {
    setDrawerTarget(t);
  }
  function openCountryProfile(c: string) {
    openTarget({ kind: "country", code: c });
  }
  function openOrgDrawer(org: string) {
    openTarget({ kind: "org", orgId: canonicalizeOrg(org).id, label: org });
  }
  function openOrgDrawerBySymbol(symbol: string) {
    openOrgDrawer(symbolToCompanyName.get(symbol) ?? symbol);
  }
  function openEntryDrawer(entry: Entry) {
    openTarget({ kind: "entry", id: entry.id });
  }
  function highlightOrgInPipeline(org: string) {
    setDrawerTarget(null);
    setHighlightOrg((prev) => (prev === org ? null : org));
  }
  function activateFinding(card: FindingCard) {
    if (card.activateCountry) setCountry(card.activateCountry);
    if (card.activateStage) setStage(card.activateStage);
    document.getElementById(card.scrollToId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    openTarget(card.drawerTarget);
  }
  function activateChangeLogItem(item: ChangeLogItem) {
    if (item.activateCountry) setCountry(item.activateCountry);
    if (item.drawerTarget) openTarget(item.drawerTarget);
  }
  function clearAllSelections() {
    setCompareCountries([]);
    setCountry("all");
    setStage("all");
    setDateRange({ from: null, to: null });
  }
  function copySelectionLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  }

  const ctx: DashboardContext = {
    vertical, data, entries, shown, byStage, trend, trend21, latestNote,
    orgFinancialIndex, symbolToCompanyName,
    country, stage, dateRange, compareCountries, highlightOrg,
    dark, generated, updatedAgo,
    dashboard, navigate,
    toggleCountry, toggleStage, toggleCompareCountry, filterToCountry, clearCountryFilter,
    openTarget, openCountryProfile, openOrgDrawer, openOrgDrawerBySymbol, openEntryDrawer,
    highlightOrgInPipeline, setHighlightOrg, setRecordExplorerStage,
    activateFinding, activateChangeLogItem, clearAllSelections, copySelectionLink,
    sankeyMeasure, setSankeyMeasure,
  };

  // Real countries present in this technology's own data — never a
  // hardcoded list, so a country only appears here if it actually has at
  // least one tracked record.
  const availableCountries = useMemo(() => {
    const codes = new Set<string>();
    for (const e of entries) if (e.country) codes.add(e.country);
    return [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  }, [entries]);

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="verticals">
            {VERTICALS.map((v) => (
              <button key={v.id} className="vtab" aria-pressed={v.id === vertical.id} onClick={() => switchTechnology(v.id)}>
                {v.number} · {v.shortLabel}
              </button>
            ))}
          </span>
          <img className="wordmark-logo" src={dark ? logoDarkBg : logoLightBg} alt="Tech Futures Lab" />
          <span className="topbar-meta">
            <span>● {statusText}</span>
            <span title="Nightly build timestamp — this app reads a static build, it doesn't live-query sources on page load">
              {generated}{updatedAgo ? ` · ${updatedAgo}` : ""}
            </span>
          </span>
          <button className="theme-toggle" onClick={() => setDark((d) => !d)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </div>

      <NewsTicker entries={shown} onSelect={openEntryDrawer} />

      <div className="wrap">
        <div className="pagehead">
          <div>
            <h1>{vertical.label}</h1>
            <div className="sub">{vertical.tagline}</div>
          </div>
        </div>

        <DashboardNavigation active={dashboard} onNavigate={navigate} />

        <DashboardFilters
          country={country}
          onSetCountry={setCountry}
          availableCountries={availableCountries}
          dateFrom={dateRange.from}
          dateTo={dateRange.to}
          onSetDateFrom={(v) => setDateRange((d) => ({ ...d, from: v }))}
          onSetDateTo={(v) => setDateRange((d) => ({ ...d, to: v }))}
          onClearDate={() => setDateRange({ from: null, to: null })}
          compareCountries={compareCountries}
          onClearCountry={clearCountryFilter}
          onCopyLink={copySelectionLink}
          onResetDashboard={clearAllSelections}
          technologyLabel={vertical.shortLabel}
        />

        {dashboard === "overview" && <Overview ctx={ctx} />}
        {dashboard === "research" && <TrackResearch ctx={ctx} />}
        {dashboard === "scaling" && <TrackScaling ctx={ctx} />}
        {dashboard === "adoption" && <TrackAdoption ctx={ctx} />}
        {dashboard === "money" && <TrackMoney ctx={ctx} />}

        <footer className="foot">
          <ExpandableMethods summary="Coverage and methods differ by dashboard.">
            Innovation streams from OpenAlex (institution country codes) with an arXiv fallback, plus EPO
            patents where a key is set. Scaling and adoption are curated in <code>data/{vertical.dataDir}/seed.ts</code> plus a
            live RSS layer. Investment is NSF Awards (US) — no equivalent public feed exists for China — plus
            auto-classified funding news from Google News RSS.
            Analyst notes live in <code>data/{vertical.dataDir}/notes.ts</code>. Every entry logs the real country an
            institution/awardee/filer is located in — country attribution is a lead, not a verdict.
            "Country innovation share" plots a trailing 7-day rolling average of recorded history only — no projection.
            "Who's producing the work" omits citation counts: OpenAlex citation data takes months to accrue and this
            corpus is mostly days old, so a citations column would currently read as all zeros. "Disclosed award sizes"
            covers NSF grants only; private hyperscaler/lab capital spend, which dwarfs NSF's disclosed totals for this
            vertical, has no public per-grant source and isn't included. Percentage deltas are hidden outright when the
            prior comparison period is too thin to be a real baseline. The collaboration network only counts a real
            paper once, as an edge between every pair of countries its authors' resolvable institutions span —
            domestic-only papers and works with no resolvable institution data contribute nothing to it. Corporate
            R&D figures in Track Money are each company's total R&D spend, not field-specific spending; market
            capitalization is a standing fact about a company, not capital flowing into this field. An organization
            field is left blank, never substituted with a publisher's name, when the real actor behind a scaling or
            adoption record can't be identified from an RSS item alone.
          </ExpandableMethods>
          <div className="sig">Ideas Advancing Freedom</div>
        </footer>
      </div>

      {recordExplorerStage && (
        <RecordExplorer
          stage={recordExplorerStage}
          entries={byStage[recordExplorerStage]}
          onClose={() => setRecordExplorerStage(null)}
          onSelectEntry={(entry) => { setRecordExplorerStage(null); openEntryDrawer(entry); }}
        />
      )}

      {drawerTarget && data && (
        <MetadataDrawer
          target={drawerTarget}
          data={data}
          trend={trend}
          orgFinancialIndex={orgFinancialIndex}
          compareCountries={compareCountries}
          onClose={() => setDrawerTarget(null)}
          onFilterCountry={filterToCountry}
          onToggleCompare={toggleCompareCountry}
          onOpenTarget={openTarget}
          onHighlightOrg={highlightOrgInPipeline}
        />
      )}
    </>
  );
}
