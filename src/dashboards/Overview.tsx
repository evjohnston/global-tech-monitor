import { useMemo, useState } from "react";
import type { DashboardContext } from "./types.ts";
import { countByCountry, topCountries } from "../lib/aggregate.ts";
import { overviewHeadline } from "../lib/findings.ts";
import { computeDashboardSummaryCards } from "../lib/dashboardSummaryCards.ts";
import { computeCountryProfile } from "../lib/countryProfile.ts";
import { computeDashboardFindings } from "../lib/findingsEngine.ts";
import { countryName } from "../lib/countries.ts";
import { WorldMap } from "../components/WorldMap.tsx";
import { EcosystemMatrix } from "../components/EcosystemMatrix.tsx";
import { LeaderCard } from "../components/LeaderCard.tsx";
import { LeadershipStackChart } from "../components/LeadershipStackChart.tsx";
import { ResearchAdoptionGapChart } from "../components/ResearchAdoptionGapChart.tsx";
import { ChangeLog } from "../components/ChangeLog.tsx";
import { SourceDisclosure } from "../components/SourceDisclosure.tsx";
import { CompareRibbon } from "../components/CompareRibbon.tsx";
import { FindingsPanel } from "../components/FindingsPanel.tsx";
import { SectionHeader, ChartFrame } from "../components/ChartFrame.tsx";
import { MethodNote } from "../components/MethodNote.tsx";
import type { Dashboard } from "../lib/urlState.ts";

const MAP_METRICS: { key: "research" | "scaling" | "adoption" | "money" | "combined"; label: string; stage: "innovation" | "scaling" | "adoption" | "investment" | null }[] = [
  { key: "research", label: "Research", stage: "innovation" },
  { key: "scaling", label: "Scaling", stage: "scaling" },
  { key: "adoption", label: "Adoption", stage: "adoption" },
  { key: "money", label: "Money", stage: "investment" },
  { key: "combined", label: "Combined", stage: null },
];

// The Overview answers, in order: who leads each part of the system, where
// research and adoption diverge, who's gaining ground, what changed
// recently, and where to go for more detail — never every detailed chart
// from the 4 Track dashboards, just the cross-cutting comparison those
// dashboards can't show on their own.
export function Overview({ ctx }: { ctx: DashboardContext }) {
  const { data, entries, trend21, country, compareCountries, dark, generated, updatedAgo, navigate, openCountryProfile, openTarget, toggleCompareCountry, activateChangeLogItem, mapMetric, setMapMetric } = ctx;
  const [profileCountry, setProfileCountry] = useState<string | null>(null);

  const headline = useMemo(() => overviewHeadline(entries), [entries]);
  const cards = useMemo(() => computeDashboardSummaryCards(entries), [entries]);
  const findings = useMemo(() => computeDashboardFindings(entries, "overview", country), [entries, country]);

  const mapCounts = useMemo(() => {
    const metric = MAP_METRICS.find((m) => m.key === mapMetric)!;
    return metric.stage ? countByCountry(entries, metric.stage) : countByCountry(entries);
  }, [entries, mapMetric]);

  const topFilterCountries = useMemo(() => topCountries(countByCountry(entries), 8).top.map((c) => c.country), [entries]);

  // Chart A ("leadership across the stack") defaults to US/China per spec —
  // falls back to the two most active real countries only in the
  // theoretical case neither the US nor China has any tracked activity at
  // all in this vertical.
  const stackCountries = useMemo(() => {
    if (compareCountries.length >= 2) return compareCountries;
    if (topFilterCountries.includes("US") && topFilterCountries.includes("CN")) return ["US", "CN"];
    return topFilterCountries.slice(0, 2);
  }, [compareCountries, topFilterCountries]);

  // The global country filter previously did nothing on this page at all —
  // every chart here reads from the full, unfiltered `entries` on purpose
  // (Overview's charts are inherently cross-country comparisons; re-running
  // them against `shown` would collapse a top-8 matrix/map/gap-chart down
  // to one trivial row the moment a filter is set). The real fix isn't to
  // filter the data, it's to make the filter visibly DO something: it now
  // drives which country the map highlights and the inline profile panel
  // opens for (an explicit map click still wins, so clicking a different
  // country to preview doesn't fight the persistent filter), and which row
  // stands out (not faded) in the leadership matrix below.
  const activeProfileCountry = profileCountry ?? (country !== "all" ? country : null) ?? compareCountries[0] ?? null;
  const matrixEmphasis = country !== "all" && !compareCountries.includes(country) ? [country, ...compareCountries] : compareCountries;
  const profile = useMemo(() => (activeProfileCountry ? computeCountryProfile(entries, activeProfileCountry) : null), [entries, activeProfileCountry]);

  function handleMapSelect(code: string) {
    setProfileCountry(code);
  }

  function handleMatrixCell(country: string, dashboard: Dashboard) {
    navigate(dashboard, { country });
  }

  function handleOpenCard(dashboard: Dashboard, country: string | null) {
    navigate(dashboard, { country: country ?? undefined });
  }

  return (
    <div className="overview">
      {headline && <h1 className="finding-headline">{headline}</h1>}
      <div className="trend-note" style={{ marginBottom: 14 }}>
        Last updated {generated}{updatedAgo ? ` · ${updatedAgo}` : ""}
        {country !== "all" && ` · Filtered to ${countryName(country)}: highlighted on the map and matrix below, and opened in the profile panel — this page's charts stay cross-country comparisons by design, so the filter emphasizes rather than restricts them.`}
      </div>

      {cards.length > 0 && (
        <div className="leader-card-row" style={{ marginBottom: 14 }}>
          {cards.map((c) => (
            <LeaderCard key={c.dashboard} card={c} onOpen={handleOpenCard} />
          ))}
        </div>
      )}

      <FindingsPanel findings={findings} onOpenTarget={openTarget} />

      <div className="panel" id="overview-matrix">
        <SectionHeader
          title="Which countries lead each part of the system?"
          note={
            <MethodNote>
              Each column is a real per-stage rank/share of tracked entries, computed independently — a country's Research rank has no
              bearing on its Money rank. Money uses investment-stage records (NSF grants + disclosed private rounds) — the same
              US/EU-weighted coverage as the rest of this app, not the company-level VC/R&D/market-cap data in Track Money, which has
              no country field. Click any cell to open that dashboard filtered to that country.
            </MethodNote>
          }
        />
        <EcosystemMatrix entries={entries} compareCountries={matrixEmphasis} onSelectCell={handleMatrixCell} />
      </div>

      <div className="panel" id="overview-strategic">
        <SectionHeader
          title="How does leadership compare across the technology stack?"
          takeaway="Compare up to four countries — defaults to the United States and China — across all four tracked stages at once."
        />
        <CompareRibbon entries={entries} available={topFilterCountries} selected={compareCountries} onToggle={toggleCompareCountry} />
        <LeadershipStackChart entries={entries} countries={stackCountries} />
      </div>

      <div className="panel" id="overview-gap">
        <ChartFrame
          title="Which countries have more research activity than adoption activity?"
          takeaway="Positive bars mean more tracked research than adoption; negative bars mean the reverse. This measures two independent shares, not a conversion rate."
          note={<MethodNote>Research share minus adoption share, each computed independently as a share of that stage's own tracked total. Shown for the countries with the most combined research and adoption activity. Never implies research converts into adoption — that causal claim isn't supportable from this data.</MethodNote>}
        >
          <ResearchAdoptionGapChart entries={entries} countries={topFilterCountries} />
        </ChartFrame>
      </div>

      <div className="panel map-panel" id="overview-map">
        <SectionHeader
          title="Where is tracked activity concentrated?"
          note={<MethodNote>Every country with at least one attributed record in the selected metric is shaded, sqrt-scaled so a couple of dominant countries don't wash out smaller real ones. "Combined" sums all 4 stages without weighting. Country attribution is a lead, not a verdict.</MethodNote>}
        />
        <div className="tab-bar">
          {MAP_METRICS.map((m) => (
            <button key={m.key} className="chip" aria-pressed={mapMetric === m.key} onClick={() => setMapMetric(m.key)}>{m.label}</button>
          ))}
        </div>
        <div className="trend-note" style={{ marginBottom: 6 }}>
          {MAP_METRICS.find((m) => m.key === mapMetric)!.label} · real tracked-entry counts (not shares), not normalized per-capita · as of {generated}
        </div>
        <div className="map-fill">
          <WorldMap counts={mapCounts} onSelect={handleMapSelect} active={activeProfileCountry} emphasize={compareCountries} trend={trend21} dark={dark} />
        </div>
      </div>

      {profile && (
        <div className="panel country-profile-inline">
          <h3>{countryName(profile.code)}</h3>
          <div className="country-profile-ranks">
            {profile.ranks.map((r) => (
              <div key={r.stage} className="country-profile-rank">
                <span className="drawer-field-label">{r.label}</span>
                <span className="drawer-field-value">{r.rank != null ? `#${r.rank}` : "no records"}</span>
              </div>
            ))}
          </div>
          {profile.leadingInstitution && <div className="drawer-note">Leading institution: {profile.leadingInstitution}</div>}
          {profile.largestRecentChangeLabel && <div className="drawer-note">Largest recent change: {profile.largestRecentChangeLabel}</div>}
          <button className="viewall" onClick={() => openCountryProfile(profile.code)}>Open full country profile →</button>
        </div>
      )}

      <div id="overview-changelog">
        <ChangeLog entries={entries} onSelectItem={activateChangeLogItem} />
      </div>

      {data && (
        <div className="panel" id="overview-sources">
          <SourceDisclosure sourceMeta={data.sourceMeta} generated={data.generatedAt} />
        </div>
      )}
    </div>
  );
}
