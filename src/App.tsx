import { useEffect, useMemo, useRef, useState } from "react";
import type { DataFile, Entry, Stage, StageNote } from "./lib/types.ts";
import { STAGES } from "./lib/types.ts";
import { countryColor, countryName } from "./lib/countries.ts";
import { VERTICALS } from "./lib/verticals.ts";
import {
  countByCountry, countByStage, countryShares,
  fundingByCountry, orgLeaderboard, pctDelta, periodCounts, periodFunding, topCountries,
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

  const fundingTop = useMemo(() => topCountries(fundingByCountry(entries), 5), [entries]);
  const fundingGrandTotal = fundingTop.top.reduce((s, c) => s + c.count, 0) + fundingTop.rest.reduce((s, c) => s + c.count, 0) || 1;

  const STAGE_PIE_COLOR: Record<Stage, string> = { innovation: "var(--cn)", scaling: "var(--eu)", adoption: "var(--us)", investment: "var(--ink-2)" };

  // Real period-over-period deltas — null (and hidden) when there's no honest
  // baseline. Computed off `shown` (the country-filtered set) rather than the
  // full `entries`, so the KPI row actually answers "how is the filtered
  // country doing" once a filter is active, instead of always reporting the
  // whole vertical regardless of what's selected.
  const totalPeriod = useMemo(() => STAGES.reduce((acc, s) => {
    const { current, previous } = periodCounts(shown, s.id, WINDOW_DAYS);
    return { current: acc.current + current, previous: acc.previous + previous };
  }, { current: 0, previous: 0 }), [shown]);
  const innovationPeriod = useMemo(() => periodCounts(shown, "innovation", WINDOW_DAYS), [shown]);
  const investmentPeriod = useMemo(() => periodCounts(shown, "investment", WINDOW_DAYS), [shown]);
  const fundingPeriod = useMemo(() => periodFunding(shown, WINDOW_DAYS), [shown]);
  const filterSuffix = country !== "all" ? ` · ${countryName(country)}` : "";

  // The headline comparison is anchored on the US specifically — this is a
  // US policy-audience instrument, so "how does the US compare" is the
  // fixed question. (An earlier version anchored on "whichever country
  // actually leads this vertical's innovation output," which is correct in
  // the abstract but reads as a bug in practice: quantum's real overall
  // leader is China, not the US, so filtering to Germany produced "China –
  // Germany gap" instead of the "US – Germany gap" every other filter
  // choice was supposed to produce.) `compareCountry` is the second half:
  // the filtered country when one's selected (other than the US itself,
  // which just collapses back to the top non-US rival), else the top
  // non-US rival — so "all"/US/whichever country already trails the US
  // render the same US-vs-top-rival gap, and filtering to any other real
  // country (India, Germany, ...) swaps the comparison to "US – <that
  // country>." Still reads off the full unfiltered `innovationCounts` (via
  // overallShares/trend21 below) — both countries need their real overall
  // shares, which a country-filtered subset alone can't provide.
  const leadCountry = "US";
  const rankedByVolume = useMemo(() => topCountries(innovationCounts, 5).top, [innovationCounts]);
  const topRival = rankedByVolume.find((c) => c.country !== leadCountry)?.country;
  const compareCountry = country !== "all" && country !== leadCountry ? country : topRival;
  const hasInnovationData = Object.keys(innovationCounts).length > 0;
  const overallShares = useMemo(() => countryShares(innovationCounts), [innovationCounts]);
  const shareGap = (overallShares[leadCountry] ?? 0) - (compareCountry ? overallShares[compareCountry] ?? 0 : 0);
  const gapTrendLabel = useMemo(() => {
    if (trend21.length < 2 || !hasInnovationData) return null;
    const gapAt = (i: number) => {
      const s = countryShares(trend21[i].counts);
      return (s[leadCountry] ?? 0) - (compareCountry ? s[compareCountry] ?? 0 : 0);
    };
    const diff = gapAt(trend21.length - 1) - gapAt(0);
    return Math.abs(diff) < 0.5 ? "flat" : diff < 0 ? "narrowing" : "widening";
  }, [trend21, hasInnovationData, compareCountry]);

  // Forecast lines: top 5 countries by current innovation volume — always
  // whichever countries actually lead, so the headline comparison never
  // silently drops off the chart it anchors.
  const forecastCountries = useMemo(() => topCountries(innovationCounts, 5).top.map((c) => c.country), [innovationCounts]);
  // Project out to Dec 31 of the last recorded trend year, not a fixed
  // step count — "current trajectory through year end," derived from the
  // real last recorded date rather than hardcoded.
  const daysToYearEnd = useMemo(() => {
    if (trend.length === 0) return 4;
    const last = new Date(trend[trend.length - 1].date);
    const yearEnd = new Date(`${last.getFullYear()}-12-31`);
    const days = Math.round((yearEnd.getTime() - last.getTime()) / 86_400_000);
    return Math.max(1, days);
  }, [trend]);

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
            label="Total tracked entries"
            value={String(shown.length)}
            delta={fmtDelta(pctDelta(totalPeriod.current, totalPeriod.previous))}
            caption={`across all 4 stages · trailing ${WINDOW_DAYS}d vs prior${filterSuffix}`}
          />
          <KpiCard
            label="Innovation velocity"
            value={String(innovationPeriod.current)}
            delta={fmtDelta(pctDelta(innovationPeriod.current, innovationPeriod.previous))}
            caption={`works + patents, trailing ${WINDOW_DAYS}d${filterSuffix}`}
          />
          <KpiCard
            label={compareCountry ? `${countryName(leadCountry)} – ${countryName(compareCountry)} share gap` : "Leader share"}
            value={hasInnovationData ? `${leadCountry} +${Math.abs(shareGap).toFixed(0)}pt` : "—"}
            delta={gapTrendLabel}
            caption={gapTrendLabel ? `since ${trend21[0]?.date}` : "not enough history yet"}
          />
          <KpiCard
            label="Open funding awards"
            value={String(investmentPeriod.current)}
            delta={fmtDelta(pctDelta(investmentPeriod.current, investmentPeriod.previous))}
            caption={`NSF, disclosed only${filterSuffix}`}
          />
          <KpiCard
            label="Disclosed investment"
            value={fmtUsd(fundingPeriod.current)}
            delta={fmtDelta(pctDelta(fundingPeriod.current, fundingPeriod.previous, 10_000))}
            caption={`US / EU only, no PRC feed${filterSuffix}`}
          />
        </div>

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

        <div className="row3">
          <div className="panel">
            <h3>Entries by stage</h3>
            <PieChart
              slices={STAGES.map((s) => ({
                key: s.id, label: s.label, value: stageCounts[s.id], color: STAGE_PIE_COLOR[s.id],
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
          <h3>Country share forecast <span className="fc-tag">Projected to year end — linear trend</span></h3>
          <TrendChart trend={trend21} countries={forecastCountries} projectDays={daysToYearEnd} />
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
          institution/awardee/filer is located in — country attribution is a lead, not a verdict. Forecast
          lines are a linear extrapolation of recorded trend points, not a measurement.
          <div className="sig">Ideas Advancing Freedom</div>
        </footer>
      </div>

      {selectedEntry && <EntryModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </>
  );
}
