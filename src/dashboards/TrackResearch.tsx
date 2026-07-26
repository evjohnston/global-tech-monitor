import { useMemo } from "react";
import type { DashboardContext } from "./types.ts";
import { countByCountry, orgLeaderboard, rankOf, topCountries } from "../lib/aggregate.ts";
import { entriesAsOf, daysAgo } from "../lib/history.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { innovationByCountryClaim } from "../lib/claims.ts";
import { KpiCard } from "../components/KpiCard.tsx";
import { BarRow } from "../components/BarRow.tsx";
import { PanelTabs } from "../components/PanelTabs.tsx";
import { BumpChart } from "../components/BumpChart.tsx";
import { TrendChart } from "../components/TrendChart.tsx";
import { Leaderboard } from "../components/Leaderboard.tsx";
import { InstitutionConcentration } from "../components/InstitutionConcentration.tsx";
import { CollaborationNetwork } from "../components/CollaborationNetwork.tsx";
import { ResearchFlowSankey } from "../components/ResearchFlowSankey.tsx";
import { MethodNote } from "../components/MethodNote.tsx";
import { SectionHeader } from "../components/ChartFrame.tsx";
import { FindingsPanel } from "../components/FindingsPanel.tsx";
import { computeDashboardFindings } from "../lib/findingsEngine.ts";

const CHANGE_WINDOW_DAYS = 42;

// Research dashboard — answers "who produces the research, where is it
// concentrated, and who collaborates" before any raw record list.
export function TrackResearch({ ctx }: { ctx: DashboardContext }) {
  const {
    entries, shown, trend21, country, compareCountries, highlightOrg,
    openCountryProfile, openOrgDrawer, setHighlightOrg,
    setRecordExplorerStage, openTarget,
  } = ctx;

  const innovationCounts = useMemo(() => countByCountry(entries, "innovation"), [entries]);
  const innovationTop = useMemo(() => topCountries(innovationCounts, 6), [innovationCounts]);
  const innovationTotal = Object.values(innovationCounts).reduce((s, n) => s + n, 0) || 1;
  const orgRows = useMemo(() => orgLeaderboard(shown, "innovation", 6), [shown]);
  const orgRows20 = useMemo(() => orgLeaderboard(shown, "innovation", 20), [shown]);
  const innovationClaimTitle = useMemo(() => innovationByCountryClaim(entries), [entries]);
  const forecastCountries = useMemo(() => topCountries(innovationCounts, 5).top.map((c) => c.country), [innovationCounts]);

  const innovationEntries = useMemo(() => entries.filter((e) => e.stage === "innovation"), [entries]);
  const publications = innovationEntries.filter((e) => e.source !== "patent").length;
  const patents = innovationEntries.filter((e) => e.source === "patent").length;
  const topCountry = innovationTop.top[0];
  const runnerUpCountry = innovationTop.top[1];
  const leadershipGapPct = topCountry && runnerUpCountry
    ? ((topCountry.count - runnerUpCountry.count) / innovationTotal) * 100
    : null;
  const pastCounts = useMemo(() => countByCountry(entriesAsOf(entries, daysAgo(CHANGE_WINDOW_DAYS)), "innovation"), [entries]);
  const fastestGrowing = useMemo(() => {
    let best: { country: string; gain: number } | null = null;
    for (const c of Object.keys(innovationCounts)) {
      const gain = (innovationCounts[c] ?? 0) - (pastCounts[c] ?? 0);
      if (gain > 0 && (!best || gain > best.gain)) best = { country: c, gain };
    }
    return best;
  }, [innovationCounts, pastCounts]);
  const topOrg = orgRows[0];
  const findings = useMemo(() => computeDashboardFindings(entries, "research", country), [entries, country]);

  // Country-filtered metric row (section 5.2): every card recalculates for
  // the selected country, not just the institution card — "Top country"
  // and "Fastest-growing" drop out (they're global-comparison concepts
  // that don't mean anything once one country is the whole view), replaced
  // by that country's own share/rank. shown/orgRows already reflect the
  // active country filter (ctx filters shown by country before this
  // component ever sees it), so the institution card needs no new logic —
  // only the three record-count cards and the share/rank card do.
  const isFiltered = country !== "all";
  const countryInnovationEntries = useMemo(() => shown.filter((e) => e.stage === "innovation"), [shown]);
  const countryPublications = countryInnovationEntries.filter((e) => e.source !== "patent").length;
  const countryPatents = countryInnovationEntries.filter((e) => e.source === "patent").length;
  const countryRank = isFiltered ? rankOf(innovationCounts, country) : null;
  const countryShare = isFiltered ? ((innovationCounts[country] ?? 0) / innovationTotal) * 100 : null;

  return (
    <div>
      {isFiltered ? (
        <div className="kpirow">
          <KpiCard label={`${countryName(country)} research records`} value={String(countryInnovationEntries.length)} caption="papers, patents, and research statistics · all time" />
          <KpiCard label="Publications" value={String(countryPublications)} caption="papers + arXiv preprints" />
          <KpiCard label="Patents" value={String(countryPatents)} caption="EPO-filed patents" />
          <KpiCard label="Share / rank" value={countryRank != null ? `#${countryRank}` : "—"} caption={countryShare != null ? `${countryShare.toFixed(0)}% of tracked global output` : "no tracked output yet"} />
          <KpiCard span2 label="Top institution" value={topOrg ? topOrg.org : "—"} caption={topOrg ? `${topOrg.count} tracked works in ${countryName(country)}` : "no data yet"} />
        </div>
      ) : (
        <div className="kpirow">
          <KpiCard label="Tracked research records" value={String(innovationEntries.length)} caption="papers, patents, and research statistics · all time" />
          <KpiCard label="Publications" value={String(publications)} caption="papers + arXiv preprints" />
          <KpiCard label="Patents" value={String(patents)} caption="EPO-filed patents" />
          <KpiCard label="Top country" value={topCountry ? countryName(topCountry.country) : "—"} caption={topCountry ? `${topCountry.count} records, ${((topCountry.count / innovationTotal) * 100).toFixed(0)}% of tracked total` : "no data yet"} />
          <KpiCard label="Fastest-growing" value={fastestGrowing ? countryName(fastestGrowing.country) : "—"} caption={fastestGrowing ? `+${fastestGrowing.gain} entries over ${CHANGE_WINDOW_DAYS}d` : "not enough history yet"} />
        </div>
      )}
      <div className="trend-note" style={{ marginBottom: 14 }}>
        Coverage: OpenAlex (institution-attributed papers), EPO patents, with an arXiv fallback when OpenAlex is unreachable. Institution country is a lead, not a verdict.
      </div>

      <FindingsPanel findings={findings} onOpenTarget={openTarget} />

      <div className="panel" id="research-leadership">
        <SectionHeader
          title="Who produces the most tracked research, and by how much?"
          takeaway={
            topCountry && runnerUpCountry && leadershipGapPct != null
              ? `${countryName(topCountry.country)} leads with ${((topCountry.count / innovationTotal) * 100).toFixed(0)}% of tracked output, ${leadershipGapPct.toFixed(0)} percentage points ahead of ${countryName(runnerUpCountry.country)}.`
              : "Not enough tracked output yet to compare countries."
          }
        />
        <div className="row3">
          <div className="panel">
            <h3>Output by country</h3>
            {innovationTop.top.map((c) => (
              <BarRow
                key={c.country}
                label={countryName(c.country)}
                pct={(c.count / innovationTotal) * 100}
                color={countryColor(c.country)}
                valueLabel={`${c.count} · ${((c.count / innovationTotal) * 100).toFixed(0)}%`}
                detail={`${countryName(c.country)} · ${c.count} works · click for its profile`}
                onClick={() => openCountryProfile(c.country)}
                active={country === c.country}
                faded={!!compareCountries.length && !compareCountries.includes(c.country)}
              />
            ))}
          </div>
          <div className="panel">
            <h3>
              {innovationClaimTitle}
              <span className="drop">rank over time</span>
              <MethodNote>Rank reconstructed from real entry dates at 6 points across the trailing 90 days. Publications and patents split by Entry.source within the innovation stage; both are real, live-attributed data.</MethodNote>
            </h3>
            <BumpChart entries={entries} emphasize={compareCountries} onSelectCountry={openCountryProfile} />
          </div>
        </div>
        <div className="panel" style={{ marginTop: 6 }}>
          <h3>
            Country innovation share <span className="drop">trailing 7-day rolling average, no projection</span>
            <MethodNote>
              Smoothed with a trailing 7-day rolling sum per country before computing share, specifically so a single degraded
              ingestion day (a source outage, a fallback to a thinner-coverage feed) can't read as one country instantly at 0% and
              another at 100% — confirmed by hand against a real 2026-07-21 OpenAlex outage that briefly did exactly that before this
              fix. Recorded history only, never projected forward.
            </MethodNote>
          </h3>
          <TrendChart trend={trend21} countries={forecastCountries} emphasize={compareCountries} />
        </div>
      </div>

      <div className="panel" id="research-institutions">
        <SectionHeader title="Which institutions produce the most tracked research?" />
        <PanelTabs
          title="Institutions"
          drop="innovation"
          tabs={[
            {
              key: "top",
              label: "Top 6",
              render: () => (
                <>
                  <Leaderboard rows={orgRows} unit="works" onSelect={openOrgDrawer} activeOrg={highlightOrg} />
                  {highlightOrg && <button className="viewall" onClick={() => setHighlightOrg(null)}>Clear highlight ({highlightOrg}) →</button>}
                </>
              ),
            },
            {
              key: "concentration",
              label: "Full concentration",
              render: () => <InstitutionConcentration rows={orgRows20} onSelect={openOrgDrawer} activeOrg={highlightOrg} />,
            },
          ]}
        />
      </div>

      <div className="panel" id="research-flow">
        <SectionHeader title="How does a country's research turn into publications and patents?" />
        <ResearchFlowSankey
          entries={entries}
          onSelectCountry={openCountryProfile}
          onSelectOrg={openOrgDrawer}
          onSelectLink={(source, target) => openTarget({ kind: "researchFlowLink", source, target })}
        />
      </div>

      <div className="panel" id="research-collaboration">
        <SectionHeader title="Which countries collaborate on research together?" />
        <CollaborationNetwork entries={entries} emphasize={compareCountries} onSelectCountry={openCountryProfile} onSelectPair={(a, b) => openTarget({ kind: "collaboration", a, b })} />
      </div>

      <div className="panel" id="research-explorer">
        <h3>Research records</h3>
        <div className="trend-note" style={{ marginBottom: 8 }}>{innovationEntries.length} tracked papers, patents, and research statistics.</div>
        <button className="pill" onClick={() => setRecordExplorerStage("innovation")}>Search all research records →</button>
      </div>
    </div>
  );
}
