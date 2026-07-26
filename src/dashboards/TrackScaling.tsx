import { useMemo } from "react";
import type { DashboardContext } from "./types.ts";
import { countByCountry, orgLeaderboard, topCountries } from "../lib/aggregate.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { KpiCard } from "../components/KpiCard.tsx";
import { BarRow } from "../components/BarRow.tsx";
import { Leaderboard } from "../components/Leaderboard.tsx";
import { MilestoneTimeline } from "../components/MilestoneTimeline.tsx";
import { MethodNote } from "../components/MethodNote.tsx";
import { SectionHeader } from "../components/ChartFrame.tsx";

// Scaling dashboard — answers "who is building systems and reaching
// meaningful engineering milestones" before any raw record list. Order:
// by-country, leading organizations, verified-vs-reported, a capped
// recent-milestones list, then the full explorer.
export function TrackScaling({ ctx }: { ctx: DashboardContext }) {
  const { entries, country, compareCountries, openCountryProfile, openOrgDrawer, openEntryDrawer, setRecordExplorerStage } = ctx;

  const scalingEntries = useMemo(() => entries.filter((e) => e.stage === "scaling"), [entries]);
  const counts = useMemo(() => countByCountry(entries, "scaling"), [entries]);
  const top = useMemo(() => topCountries(counts, 8), [counts]);
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  // Org leaderboard already only sees real orgs — the RSS ingestion path
  // leaves org empty rather than substituting the publisher's own name
  // (fixed 2026-07-25: it used to default to the feed name, e.g. "Quantum
  // Zeitgeist," which outranked every real scaling organization by a wide
  // margin — see src/lib/sources/rss.ts). orgLeaderboard already skips
  // entries with no org, so this list needs no further filtering here.
  const orgRows = useMemo(() => orgLeaderboard(scalingEntries, undefined, 10), [scalingEntries]);
  const verified = scalingEntries.filter((e) => e.provenance === "seeded").length;
  const reported = scalingEntries.filter((e) => e.provenance === "auto").length;
  const topCountry = top.top[0];
  const topOrg = orgRows[0];

  return (
    <div>
      <div className="kpirow">
        <KpiCard label="Tracked scaling records" value={String(scalingEntries.length)} caption="hardware and production milestones · all time" />
        <KpiCard label="Verified" value={String(verified)} caption="hand-checked against a source URL" />
        <KpiCard label="Reported" value={String(reported)} caption="RSS auto-classified, weakest tier" />
        <KpiCard label="Top country" value={topCountry ? countryName(topCountry.country) : "—"} caption={topCountry ? `${topCountry.count} records, ${((topCountry.count / total) * 100).toFixed(0)}% of tracked total` : "no data yet"} />
        <KpiCard label="Top organization" value={topOrg ? topOrg.org : "—"} caption={topOrg ? `${topOrg.count} tracked milestones` : "no data yet"} />
      </div>
      <div className="trend-note" style={{ marginBottom: 14 }}>
        Coverage: hand-verified milestones (data/&lt;vertical&gt;/seed.ts) plus a live RSS layer from trade press — the RSS layer's stage/country calls are a keyword guess, weakest attribution tier in this app. The organization field is left blank rather than substituted with a publisher's name when the real actor can't be identified.
      </div>

      <div className="row3">
        <div className="panel">
          <SectionHeader title="Which countries lead scaling activity?" />
          {top.top.map((c) => (
            <BarRow
              key={c.country}
              label={countryName(c.country)}
              pct={(c.count / total) * 100}
              color={countryColor(c.country)}
              valueLabel={`${c.count} · ${((c.count / total) * 100).toFixed(0)}%`}
              detail={`${countryName(c.country)} · ${c.count} milestones · click for its profile`}
              onClick={() => openCountryProfile(c.country)}
              active={country === c.country}
              faded={!!compareCountries.length && !compareCountries.includes(c.country)}
            />
          ))}
          {top.rest.length > 0 && <div className="trend-note" style={{ marginTop: 8, fontSize: 11 }}>+{top.rest.length} more countries, {top.rest.reduce((s, c) => s + c.count, 0)} milestones</div>}
        </div>
        <div className="panel">
          <SectionHeader
            title="Which organizations lead scaling activity?"
            note={<MethodNote>Grouped by the real organization achieving each milestone — a trade-press outlet reporting on a milestone (e.g. Quantum Zeitgeist, The Quantum Insider) is never counted as the organization that achieved it.</MethodNote>}
          />
          <Leaderboard rows={orgRows} unit="milestones" onSelect={openOrgDrawer} />
        </div>
        <div className="panel">
          <SectionHeader title="How much of this is independently verified?" />
          <BarRow label="Verified" pct={total > 0 ? (verified / (verified + reported || 1)) * 100 : 0} color="var(--status-verified)" valueLabel={String(verified)} detail={`${verified} hand-verified milestones`} />
          <BarRow label="Reported" pct={total > 0 ? (reported / (verified + reported || 1)) * 100 : 0} color="var(--status-reported)" valueLabel={String(reported)} detail={`${reported} RSS auto-classified milestones`} />
          <div className="cap" style={{ marginTop: 8 }}>Verified = hand-checked against its source before being added. Reported = keyword-classified from trade press, not independently confirmed.</div>
        </div>
      </div>

      <div className="panel">
        <SectionHeader
          title="What are the most recent scaling milestones?"
          note={<MethodNote>Grouped by real fields only — organization, country, date, and verification tier. This app's data model doesn't carry a hardware-platform or milestone-type category, so none is fabricated here.</MethodNote>}
        />
        <MilestoneTimeline entries={scalingEntries} onSelectEntry={openEntryDrawer} onViewAll={() => setRecordExplorerStage("scaling")} />
      </div>
    </div>
  );
}
