import { useMemo } from "react";
import type { DashboardContext } from "./types.ts";
import { countByCountry, orgLeaderboard, topCountries } from "../lib/aggregate.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { KpiCard } from "../components/KpiCard.tsx";
import { BarRow } from "../components/BarRow.tsx";
import { Leaderboard } from "../components/Leaderboard.tsx";
import { RecentEntries } from "../components/RecentEntries.tsx";
import { MethodNote } from "../components/MethodNote.tsx";
import { PolicyTakeaway, SectionHeader } from "../components/ChartFrame.tsx";

const RECENT_LIMIT = 5;

// Adoption's data model doesn't carry sector/vendor/deployment-status
// fields (announced/pilot/procurement/deployed/operating) — this app only
// has country, org, date, and provenance (seeded=verified deployment
// record, auto=RSS-classified news) for adoption-stage entries. Rather
// than fabricate a status taxonomy the data can't support, this dashboard
// is honest about the gap and uses the one real status-like axis that
// exists: verified vs. reported. Order: by-country, leading adopters,
// verification mix, recent records, explorer.
export function TrackAdoption({ ctx }: { ctx: DashboardContext }) {
  const { entries, shown, country, compareCountries, openCountryProfile, openOrgDrawer, openEntryDrawer, setRecordExplorerStage } = ctx;

  const adoptionEntries = useMemo(() => entries.filter((e) => e.stage === "adoption"), [entries]);
  const counts = useMemo(() => countByCountry(entries, "adoption"), [entries]);
  const top = useMemo(() => topCountries(counts, 8), [counts]);
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  // orgLeaderboard already skips entries with no org — and the RSS
  // ingestion path (src/lib/sources/rss.ts) no longer substitutes the
  // publisher's own name when it can't identify the real adopter (fixed
  // 2026-07-25: "The Quantum Insider"/"Quantum Zeitgeist"/"Quantum
  // Computing Report" previously topped this exact leaderboard, above
  // every real adopter). What's left here genuinely represents adopters.
  const orgRows = useMemo(() => orgLeaderboard(adoptionEntries, undefined, 10), [adoptionEntries]);
  const verified = adoptionEntries.filter((e) => e.provenance === "seeded").length;
  const reported = adoptionEntries.filter((e) => e.provenance === "auto").length;
  const topCountry = top.top[0];
  const topAdopter = orgRows[0];
  const shownAdoption = useMemo(() => shown.filter((e) => e.stage === "adoption"), [shown]);

  return (
    <div>
      <PolicyTakeaway tone="warning">
        Adoption here means tracked deployment or procurement records. The dataset does not yet consistently separate
        announcements, pilots, procurements, deployed systems, and operating systems — the one real status-like distinction
        available today is verification tier (verified vs. reported), used below.
        <MethodNote>Verified = hand-checked against its source before being added (data/&lt;vertical&gt;/seed.ts). Reported = keyword-classified from trade press RSS — real automation, but a weaker attribution tier; stage/country calls there are a guess.</MethodNote>
      </PolicyTakeaway>

      <div className="kpirow">
        <KpiCard label="Tracked adoption records" value={String(adoptionEntries.length)} caption="deployment and procurement records · all time" />
        <KpiCard label="Verified" value={String(verified)} caption="hand-checked against a source URL" />
        <KpiCard label="Reported" value={String(reported)} caption="RSS auto-classified, weakest tier" />
        <KpiCard label="Top country" value={topCountry ? countryName(topCountry.country) : "—"} caption={topCountry ? `${topCountry.count} records, ${((topCountry.count / total) * 100).toFixed(0)}% of tracked total` : "no data yet"} />
        <KpiCard label="Top adopter" value={topAdopter ? topAdopter.org : "Unknown adopter"} caption={topAdopter ? `${topAdopter.count} tracked records` : "no adopter identifiable yet"} />
      </div>

      <div className="row3">
        <div className="panel">
          <SectionHeader title="Which countries lead adoption activity?" />
          {top.top.map((c) => (
            <BarRow
              key={c.country}
              label={countryName(c.country)}
              pct={(c.count / total) * 100}
              color={countryColor(c.country)}
              valueLabel={`${c.count} · ${((c.count / total) * 100).toFixed(0)}%`}
              detail={`${countryName(c.country)} · ${c.count} adoption records · click for its profile`}
              onClick={() => openCountryProfile(c.country)}
              active={country === c.country}
              faded={!!compareCountries.length && !compareCountries.includes(c.country)}
            />
          ))}
          {top.rest.length > 0 && <div className="trend-note" style={{ marginTop: 8, fontSize: 11 }}>+{top.rest.length} more countries, {top.rest.reduce((s, c) => s + c.count, 0)} records</div>}
        </div>
        <div className="panel">
          <SectionHeader
            title="Who are the leading adopters?"
            note={<MethodNote>Grouped by the real adopting organization — a trade-press outlet reporting on a deployment is never counted as the adopter itself. Entries where the real adopter can't be identified show no organization rather than a substituted publisher name.</MethodNote>}
          />
          <Leaderboard rows={orgRows} unit="records" onSelect={openOrgDrawer} />
        </div>
        <div className="panel">
          <SectionHeader title="How much of this is independently verified?" />
          <BarRow label="Verified deployments" pct={total > 0 ? (verified / (verified + reported || 1)) * 100 : 0} color="var(--status-verified)" valueLabel={String(verified)} detail={`${verified} hand-verified adoption records`} />
          <BarRow label="Reported / news" pct={total > 0 ? (reported / (verified + reported || 1)) * 100 : 0} color="var(--status-reported)" valueLabel={String(reported)} detail={`${reported} RSS auto-classified adoption records`} />
        </div>
      </div>

      <div className="panel">
        <SectionHeader title="What are the most recent adoption records?" />
        <RecentEntries entries={shownAdoption} limit={RECENT_LIMIT} onSelect={openEntryDrawer} />
        {shownAdoption.length > RECENT_LIMIT && (
          <button className="viewall" onClick={() => setRecordExplorerStage("adoption")}>View all {shownAdoption.length} adoption records →</button>
        )}
      </div>
    </div>
  );
}
