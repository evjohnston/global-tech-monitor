import { useEffect, useMemo, useRef, useState } from "react";
import type { DataFile, Entry, Stage, StageNote } from "./lib/types.ts";
import { STAGES } from "./lib/types.ts";
import { countryColor, countryName } from "./lib/countries.ts";
import { VERTICALS } from "./lib/verticals.ts";
import {
  countByCountry, countByStage, countryShares,
  fundingByCountry, orgLeaderboard, safeDelta, periodCounts, periodFunding, topCountries,
} from "./lib/aggregate.ts";
import { StageColumn } from "./components/StageColumn.tsx";
import { NewsTicker } from "./components/NewsTicker.tsx";
import { TrendChart } from "./components/TrendChart.tsx";
import { VolumeTrend } from "./components/VolumeTrend.tsx";
import { BarRow } from "./components/BarRow.tsx";
import { KpiCard } from "./components/KpiCard.tsx";
import { WorldMap } from "./components/WorldMap.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";
import { RecentEntries } from "./components/RecentEntries.tsx";
import { PieChart } from "./components/PieChart.tsx";
import { EntryModal } from "./components/EntryModal.tsx";
import { fmtUsd } from "./lib/format.ts";
import { STAGE_COLOR } from "./lib/stageColor.ts";
import { StageComposition } from "./components/StageComposition.tsx";
import { SmallMultiples } from "./components/SmallMultiples.tsx";
import { InstitutionConcentration } from "./components/InstitutionConcentration.tsx";
import { AwardSizeHistogram } from "./components/AwardSizeHistogram.tsx";
import { TopCitedTicker } from "./components/TopCitedTicker.tsx";

// Static-store-only (2026-07-20): the frontend reads whichever
// public/data/<vertical>.json the nightly build last wrote and nothing
// else — it never live-queries OpenAlex/EPO/NSF/RSS itself. That build is
// the one real ingestion pipeline (scripts/fetch-data.ts, on a schedule —
// see build-and-deploy.yml); the browser used to layer a live re-fetch on
// top (direct OpenAlex + the Worker for EPO/NSF/RSS) but that meant two
// different code paths could show two different pictures of "now," and the
// UI's "refreshed live"/auto-refresh pulse implied a streaming feed this
// app was never built to be. worker/ still exists and is still deployed —
// it's just unused by this frontend now; left in place in case a future
// on-demand feature wants it, not decommissioned.
type LiveMode = "loading" | "static" | "fallback";
const WINDOW_DAYS = 21;
const TOP_N = 6; // compact-view country count — every real country still gets
// counted everywhere; this only bounds how many show up in chips/bars/KPIs.
// The full map has no such cap.

function fmtDelta(pct: number | null): string | null {
  if (pct == null) return null;
  if (Math.abs(pct) < 0.05) return "flat";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}

export default function App() {
  const [verticalId, setVerticalId] = useState(VERTICALS[0].id);
  const vertical = VERTICALS.find((v) => v.id === verticalId) ?? VERTICALS[0];
  const [data, setData] = useState<DataFile | null>(null);
  const [country, setCountry] = useState<string | "all">("all");
  const [mode, setMode] = useState<LiveMode>("loading");
  const [highlightOrg, setHighlightOrg] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("gtm-theme");
    if (saved === "dark" || saved === "light") return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [nowTick, setNowTick] = useState(0);
  // Per-vertical in-memory cache — each data file runs ~2-3MB (abstracts,
  // authors, citations on every entry add up across 1000+ entries), so
  // re-fetching and re-parsing it from scratch on every tab switch is real,
  // avoidable latency once a vertical's already been visited this session.
  // Switching back to a vertical already in this map shows its last-known
  // data instantly while the same fetch below still re-checks the static
  // file underneath (in case the nightly build landed a new one while this
  // tab was open) — never permanently stale, just not blocking on repeat
  // visits. First-ever visit to a vertical is still bound by that file's
  // real network+parse time; this doesn't shrink the file itself.
  const dataCacheRef = useRef<Record<string, DataFile>>({});

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("gtm-theme", dark ? "dark" : "light");
  }, [dark]);

  // A real ticking clock — "12s ago" against the actual last-fetch
  // timestamp, not a fabricated animation. nowTick just forces a re-render
  // each second; the value itself isn't read anywhere.
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cached = dataCacheRef.current[vertical.id];
    setData(cached ?? null);
    setMode(cached ? "static" : "loading");
    setCountry("all");
    setHighlightOrg(null);
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
  // Every time-based chart (volume trend, country-share forecast, the map's
  // time scrubber) shows a rolling 21-day window, not the full accumulated
  // history — same window as the KPI row's trailing-21d deltas, so "trend"
  // means one consistent thing across the page. The full history stays in
  // `trend`/the data file itself; this is a display-only slice.
  const trend21 = useMemo(() => trend.slice(-21), [trend]);
  const shown = country === "all" ? entries : entries.filter((e) => e.country === country);

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

  // Which countries drive the compact views — real ranking off real
  // volume, not a hardcoded list. Computed across all stages so the top
  // filter chips reflect the whole dataset, not just one lens.
  const topFilterCountries = useMemo(() => topCountries(countByCountry(entries), TOP_N).top, [entries]);

  const innovationCounts = useMemo(() => countByCountry(entries, "innovation"), [entries]);
  const innovationTop = useMemo(() => topCountries(innovationCounts, TOP_N), [innovationCounts]);
  const innovationTopShares = useMemo(
    () => countryShares(Object.fromEntries(innovationTop.top.map((c) => [c.country, c.count]))),
    [innovationTop]
  );
  const innovationRestCount = innovationTop.rest.reduce((s, c) => s + c.count, 0);
  const innovationTotal = Object.values(innovationCounts).reduce((s, n) => s + n, 0) || 1;

  const stageCounts = useMemo(() => countByStage(entries), [entries]);
  const stageTotal = Object.values(stageCounts).reduce((s, n) => s + n, 0) || 1;
  const orgRows = useMemo(() => orgLeaderboard(shown, "innovation", 6), [shown]);
  const orgRows20 = useMemo(() => orgLeaderboard(shown, "innovation", 20), [shown]);

  const fundingTop = useMemo(() => topCountries(fundingByCountry(entries), 5), [entries]);
  const fundingGrandTotal = fundingTop.top.reduce((s, c) => s + c.count, 0) + fundingTop.rest.reduce((s, c) => s + c.count, 0) || 1;

  // Real period-over-period counts — computed off `shown` (the country-
  // filtered set) rather than the full `entries`, so the KPI row actually
  // answers "how is the filtered country doing" once a filter is active.
  // Only innovationPeriod's delta is ever shown (gated on velocityDeltaReady
  // above) — Card 1/3/5 never show a delta, Card 4 dropped its delta
  // outright (gtm-claude-code-spec.md Part 1).
  const innovationPeriod = useMemo(() => periodCounts(shown, "innovation", WINDOW_DAYS), [shown]);
  const fundingPeriod = useMemo(() => periodFunding(shown, WINDOW_DAYS), [shown]);
  // Card 3 — verified milestones only (hand-checked against a source URL,
  // not RSS-classified), across the two stages where "seeded" actually
  // means something distinct from "live": innovation's seeded/live split
  // doesn't exist (OpenAlex/EPO are both "live"), but scaling/adoption's
  // does. Immune to auto-classified RSS volume noise by construction.
  const frontierReleases = useMemo(
    () => shown.filter((e) => e.provenance === "seeded" && (e.stage === "scaling" || e.stage === "adoption")).length,
    [shown]
  );
  const filterSuffix = country !== "all" ? ` · ${countryName(country)}` : "";

  // Card 1 anchors on the US and compares it to whichever country is
  // actually relevant: the filtered country when one's selected (US vs.
  // India when filtered to India, US vs. Germany for Germany), else the
  // top non-US rival by volume (US vs. China today, but derived from real
  // data rather than hardcoded — see CLAUDE.md on not reintroducing a
  // US/CN-bucket assumption). Restored filter-reactivity 2026-07-21 after
  // a first pass made this card fixed; kept from THAT pass: point-in-time
  // only, no direction word, no delta — an earlier build flip-flopped
  // between "CN +3pt narrowing" and "US +4pt widening" off ~6 days of real
  // history, same underlying metric telling opposite stories. The VALUE
  // still names whichever of the two actually leads (not always "US"), so
  // a filter where the US trails still reads honestly.
  const hasInnovationData = Object.keys(innovationCounts).length > 0;
  const overallShares = useMemo(() => countryShares(innovationCounts), [innovationCounts]);
  const rankedByVolume = useMemo(() => topCountries(innovationCounts, 5).top, [innovationCounts]);
  const topRival = rankedByVolume.find((c) => c.country !== "US")?.country;
  const compareCountry = country !== "all" && country !== "US" ? country : topRival;
  const usShare = overallShares.US ?? 0;
  const compareShare = compareCountry ? overallShares[compareCountry] ?? 0 : 0;
  const gapLeader = usShare >= compareShare ? "US" : compareCountry;
  const gap = Math.abs(usShare - compareShare);

  // Forecast lines: top 5 countries by current innovation volume — always
  // whichever countries actually lead, so the headline comparison never
  // silently drops off the chart it anchors.
  const forecastCountries = useMemo(() => topCountries(innovationCounts, 5).top.map((c) => c.country), [innovationCounts]);

  // Small multiples get a fixed anchor instead of "top 5 by volume" — US
  // and China always, since that's the comparison the rest of this page
  // (the innovation-gap card, the recorded-share chart's usual leaders)
  // already centers on, plus whichever 2 other real countries actually
  // rank highest. Not just "top 4" — if US or China ever fell out of the
  // top 4 by volume, silently dropping them here while every other panel
  // still names them would read as inconsistent.
  const smallMultCountries = useMemo(() => {
    const ranked = topCountries(innovationCounts, 10).top.map((c) => c.country);
    const anchors = ["US", "CN"].filter((c) => (innovationCounts[c] ?? 0) > 0);
    const others = ranked.filter((c) => !anchors.includes(c)).slice(0, 2);
    return [...anchors, ...others];
  }, [innovationCounts]);

  // Real history depth, not just "trend[] is non-empty" — one point per
  // real day (see fetch-data.ts), so filtering to points that actually
  // carry the newer per-stage/funding fields (added 2026-07-20) doubles as
  // "how many real days of that data exist." Gates the innovation-velocity
  // delta per gtm-claude-code-spec.md Part 1 Card 2: a percent change is
  // only honest once it's comparing two full 21-day windows against each
  // other, which needs 42 days of real history, not just a non-zero prior
  // window (safeDelta's own minBase catches the latter, this catches the
  // former — both have to pass).
  const historyDays = useMemo(() => trend.filter((p) => p.stageCounts).length, [trend]);
  const velocityDeltaReady = historyDays >= 42;

  const generated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const statusText = mode === "loading" ? "loading" : mode === "fallback" ? "data unavailable" : "static build";
  // Ticks every second (nowTick) against the real last-fetch timestamp —
  // "12s ago," not a fabricated animation.
  const updatedAgo = (() => {
    if (!data?.generatedAt) return null;
    void nowTick;
    const secs = Math.max(0, Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 1000));
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  })();

  function toggleCountry(c: string) {
    setCountry((prev) => (prev === c ? "all" : c));
  }
  function selectOrg(org: string) {
    setHighlightOrg((prev) => (prev === org ? null : org));
    document.getElementById("stage-innovation")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function scrollToStage(s: Stage) {
    document.getElementById(`stage-${s}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="wordmark"><span className="gtm">GTM</span> / Global Tech Monitor</span>
          <span className="verticals">
            {VERTICALS.map((v) => (
              <button
                key={v.id}
                className="vtab"
                aria-pressed={v.id === vertical.id}
                onClick={() => setVerticalId(v.id)}
              >
                {v.number} · {v.shortLabel}
              </button>
            ))}
          </span>
          <span className="topbar-meta">
            <span>● {statusText}</span>
            <span title="Nightly build timestamp — this app reads a static build, it doesn't live-query sources on page load">
              {generated}{updatedAgo ? ` · ${updatedAgo}` : ""}
            </span>
          </span>
          <button
            className="theme-toggle"
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </div>

      <NewsTicker entries={shown} onSelect={setSelectedEntry} />

      <div className="wrap">
        <div className="pagehead">
          <div>
            <h1>Global Tech Monitor</h1>
            <div className="sub">{vertical.tagline}</div>
          </div>
        </div>

        <div className="controls">
          <span className="lbl">Filter country</span>
          <button className="chip" aria-pressed={country === "all"} onClick={() => setCountry("all")}>All</button>
          {topFilterCountries.map((c) => (
            <button key={c.country} className="chip" aria-pressed={country === c.country} onClick={() => toggleCountry(c.country)}>
              {countryName(c.country)}
            </button>
          ))}
          <span className="lbl" style={{ marginLeft: 2 }}>— or click any country on the map below</span>
        </div>

        <div className="kpirow">
          <KpiCard
            highlight
            label={compareCountry ? `${countryName("US")} – ${countryName(compareCountry)} innovation gap` : "Leader share"}
            value={hasInnovationData && gapLeader ? `${gapLeader} +${gap.toFixed(0)}pt` : "—"}
            caption={`innovation share · as of ${generated} · point-in-time`}
          />
          <KpiCard
            label="Innovation velocity"
            value={String(innovationPeriod.current)}
            delta={velocityDeltaReady ? fmtDelta(safeDelta(innovationPeriod.current, innovationPeriod.previous)) : null}
            caption={`works + patents, trailing ${WINDOW_DAYS}d${filterSuffix}`}
          />
          <KpiCard
            label="Frontier releases tracked"
            value={String(frontierReleases)}
            caption={`verified milestones · curated, not auto-classified${filterSuffix}`}
          />
          <KpiCard
            label="Disclosed investment"
            value={fmtUsd(fundingPeriod.current)}
            caption={`US / EU only, no PRC feed${filterSuffix}`}
          />
          <KpiCard
            label="Coverage & freshness"
            value={String(shown.length)}
            caption={`across 4 stages · static build, ${generated}${filterSuffix}`}
          />
        </div>

        <TopCitedTicker entries={entries} onSelect={setSelectedEntry} />

        <div className="row-map">
          <div className="row-map-stack">
            <div className="panel">
              <h3>Output by country · innovation stage</h3>
              {innovationTop.top.map((c) => (
                <BarRow
                  key={c.country}
                  label={countryName(c.country)}
                  pct={innovationTopShares[c.country] ?? 0}
                  color={countryColor(c.country)}
                  valueLabel={`${c.count} · ${((c.count / innovationTotal) * 100).toFixed(0)}%`}
                  detail={`${countryName(c.country)} · ${c.count} works · ${((c.count / innovationTotal) * 100).toFixed(1)}% of innovation output · click to filter`}
                  onClick={() => toggleCountry(c.country)}
                  active={country === c.country}
                />
              ))}
              {innovationRestCount > 0 && (
                <div className="trend-note" style={{ marginTop: 8, fontSize: 11 }}>
                  +{innovationTop.rest.length} more countries, {innovationRestCount} works — see the map →
                </div>
              )}
            </div>
            <div className="panel">
              <h3>Innovation output over time</h3>
              <VolumeTrend trend={trend21} />
            </div>
            <div className="panel">
              <h3>Innovation output, by country <span className="drop">trailing {trend21.length}d</span></h3>
              <SmallMultiples trend={trend21} countries={smallMultCountries} onSelectCountry={toggleCountry} active={country === "all" ? null : country} />
            </div>
          </div>
          <div className="panel map-panel">
            <h3>Where the work happens</h3>
            <div className="map-fill">
              <WorldMap counts={innovationCounts} onSelect={toggleCountry} active={country === "all" ? null : country} trend={trend21} dark={dark} />
              <div className="trend-empty" style={{ padding: "6px 0 0", fontSize: 10.5 }}>
                Every country with at least one attributed work is shaded — darker means more output. Click any country to filter the page. Drag the time bar below to see real recorded history; expand for the full interactive map.
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Where each country's activity sits</h3>
          <div className="trend-note" style={{ marginBottom: 8 }}>share of tracked entries by stage · composition, not flow</div>
          <StageComposition entries={entries} onSelectCountry={toggleCountry} active={country === "all" ? null : country} />
        </div>

        <div className="row3">
          <div className="panel">
            <h3>Entries by stage</h3>
            <PieChart
              slices={STAGES.map((s) => ({
                key: s.id, label: s.label, value: stageCounts[s.id], color: STAGE_COLOR[s.id],
                detail: `${s.label} · ${stageCounts[s.id]} entries · ${((stageCounts[s.id] / stageTotal) * 100).toFixed(1)}% of tracked total · click to jump`,
              }))}
              onSelect={(key) => scrollToStage(key as Stage)}
            />
          </div>
          <div className="panel">
            <h3>Top institutions <span className="drop">innovation</span></h3>
            <Leaderboard rows={orgRows} unit="works" onSelect={selectOrg} activeOrg={highlightOrg} />
            {highlightOrg && <button className="viewall" onClick={() => setHighlightOrg(null)}>Clear highlight ({highlightOrg}) →</button>}
          </div>
          <div className="panel">
            <h3>Recent entries</h3>
            <RecentEntries entries={shown} limit={6} onSelect={setSelectedEntry} />
          </div>
        </div>

        <div className="panel">
          <h3>Who's producing the work</h3>
          <div className="trend-note" style={{ marginBottom: 8 }}>institutions by tracked output · colored by country</div>
          <InstitutionConcentration rows={orgRows20} onSelect={selectOrg} activeOrg={highlightOrg} />
        </div>

        <div className="panel">
          <h3>Funding by country <span className="drop">investment</span></h3>
          {fundingTop.top.length === 0
            ? <div className="trend-empty">No disclosed funding yet.</div>
            : fundingTop.top.map((c) => (
              <BarRow
                key={c.country}
                label={countryName(c.country)}
                pct={(c.count / fundingGrandTotal) * 100}
                color={countryColor(c.country)}
                valueLabel={fmtUsd(c.count)}
                detail={`${countryName(c.country)} · ${fmtUsd(c.count)} disclosed · ${((c.count / fundingGrandTotal) * 100).toFixed(1)}% of tracked funding`}
              />
            ))}
          {fundingTop.rest.length > 0 && (
            <div className="trend-note" style={{ marginTop: 8, fontSize: 11 }}>
              +{fundingTop.rest.length} more countries, {fmtUsd(fundingTop.rest.reduce((s, c) => s + c.count, 0))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Disclosed award sizes</h3>
          <div className="trend-note" style={{ marginBottom: 4 }}>NSF grants only · private hyperscaler capex not shown and dwarfs this</div>
          <AwardSizeHistogram entries={shown} />
        </div>

        <div className="panel">
          <h3>Country innovation share <span className="drop">recorded</span></h3>
          <TrendChart trend={trend21} countries={forecastCountries} />
        </div>

        <section className="section">
          <div className="section-kicker">
            <span className="idx">01</span>
            <h2>The pipeline</h2>
            <span className="sub">research → scaling → adoption → investment</span>
          </div>
          <div className="pipeline">
            {STAGES.map((s) => (
              <StageColumn
                key={s.id}
                id={`stage-${s.id}`}
                stage={s.id}
                entries={byStage[s.id]}
                note={latestNote[s.id]}
                highlightOrg={s.id === "innovation" ? highlightOrg : null}
                onSelectEntry={setSelectedEntry}
              />
            ))}
          </div>
        </section>

        <footer className="foot">
          <div className="h">Sources & method</div>
          Innovation streams from OpenAlex (institution country codes) with an arXiv fallback, plus EPO
          patents where a key is set. Scaling and adoption are curated in <code>data/{vertical.dataDir}/seed.ts</code> plus a
          live RSS layer. Investment is NSF Awards (US) — no equivalent public feed exists for China — plus
          auto-classified funding news from Google News RSS.
          Analyst notes live in <code>data/{vertical.dataDir}/notes.ts</code>. Every entry logs the real country an
          institution/awardee/filer is located in — country attribution is a lead, not a verdict.
          "Country innovation share" plots recorded history only — no projection; a linear forecast used to run
          to year end here and was removed because it could land a single country near 100% share off a
          handful of days of real data. "Where each country's activity sits" and the country small-multiples
          are a composition/shape read, not a flow or a trend claim — the four pipeline stages are different
          records, not one entity moving through stages. "Who's producing the work" omits citation counts:
          OpenAlex citation data takes months to accrue and this corpus is mostly days old, so a citations
          column would currently read as all zeros. "Disclosed award sizes" covers NSF grants only; private
          hyperscaler/lab capital spend, which dwarfs NSF's disclosed totals for this vertical, has no public
          per-grant source and isn't included. Percentage deltas are hidden outright when the prior comparison
          period is too thin to be a real baseline, rather than shown as a technically-real but misleading number.
          The "Most cited" row up top is OpenAlex's real cited_by_count, ranked flat over the last 5 years —
          citations accrue over time, so older work naturally ranks higher, same as any other "most cited" list.
          <div className="sig">Ideas Advancing Freedom</div>
        </footer>
      </div>

      {selectedEntry && <EntryModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </>
  );
}
