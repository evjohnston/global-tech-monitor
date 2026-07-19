import { useEffect, useMemo, useState } from "react";
import type { DataFile, Entry, Stage, StageNote } from "./lib/types.ts";
import { STAGES } from "./lib/types.ts";
import { inferInstitutionCountry } from "./lib/institutionCountry.ts";
import { countryColor, countryName } from "./lib/countries.ts";
import { fetchOpenAlexPages } from "./lib/sources/openalex.ts";
import { VERTICALS, type VerticalConfig } from "./lib/verticals.ts";
import {
  countByCountry, countByStage, countryShares,
  fundingByCountry, orgLeaderboard, pctDelta, periodCounts, periodFunding, topCountries,
} from "./lib/aggregate.ts";
import { StageColumn } from "./components/StageColumn.tsx";
import { TrendChart } from "./components/TrendChart.tsx";
import { VolumeTrend } from "./components/VolumeTrend.tsx";
import { BarRow } from "./components/BarRow.tsx";
import { KpiCard } from "./components/KpiCard.tsx";
import { WorldMap } from "./components/WorldMap.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";
import { RecentEntries } from "./components/RecentEntries.tsx";
import { PieChart } from "./components/PieChart.tsx";

type LiveMode = "loading" | "static" | "refreshed" | "fallback";
// The EPO/NSF/news proxy — see worker/. Unset in dev until you've deployed
// one and added VITE_WORKER_URL to .env.local; those sources are just
// skipped (soft-fail) when it's not configured.
const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "");
const WINDOW_DAYS = 21;
const TOP_N = 6; // compact-view country count — every real country still gets
// counted everywhere; this only bounds how many show up in chips/bars/KPIs.
// The full map has no such cap.

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}
function fmtDelta(pct: number | null): string | null {
  if (pct == null) return null;
  if (Math.abs(pct) < 0.05) return "flat";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}

// arXiv fallback for the browser path — only used if a direct OpenAlex call
// fails. Kept separate from scripts/lib/sources/* because it leans on
// DOMParser, which only exists in the browser.
async function fetchArxivBrowser(category: string): Promise<Entry[]> {
  const url =
    `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(category)}` +
    "&sortBy=submittedDate&sortOrder=descending&max_results=200";
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
  const nodes = [...xml.getElementsByTagName("entry")];
  return nodes.map((n) => {
    const title = (n.getElementsByTagName("title")[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
    const pub = (n.getElementsByTagName("published")[0]?.textContent ?? "").slice(0, 10);
    const authors = [...n.getElementsByTagName("author")];
    const names = authors.map((a) => a.getElementsByTagName("name")[0]?.textContent ?? "");
    const affil = authors.map((a) => a.getElementsByTagName("arxiv:affiliation")[0]?.textContent ?? "").join(" ");
    const org = names.length > 1 ? `${names[0]} et al.` : names[0] ?? "";
    const links = [...n.getElementsByTagName("link")];
    const url = links.find((l) => l.getAttribute("rel") === "alternate")?.getAttribute("href")
      ?? n.getElementsByTagName("id")[0]?.textContent ?? `https://arxiv.org/list/${category}/recent`;
    const { country, evidence } = inferInstitutionCountry(`${affil} ${org} ${title}`);
    const absId = url.split("/abs/")[1] ?? title.slice(0, 40);
    return { id: `arxiv-${absId}`, stage: "innovation" as Stage, country, provenance: "auto" as const,
      source: "arxiv" as const, title, org, date: pub, url, countryEvidence: evidence };
  });
}

// One fresh read across every source that can be fetched from the browser
// (OpenAlex direct) or through the worker proxy (EPO, NSF, news). Each leg
// fails soft — same ethos as the nightly build — so one dead source never
// blanks the others. `?vertical=<id>` tells the Worker which CPC/keyword/RSS
// config to use (see worker/src/index.ts + src/lib/verticals.ts).
async function fetchLive(v: VerticalConfig): Promise<{ entries: Entry[]; failed: string[] }> {
  const failed: string[] = [];
  let innovation: Entry[] = [];
  try {
    innovation = await fetchOpenAlexPages({ filter: v.openAlexFilter, mailto: "gtm@example.com", n: 200, pages: 3 });
  } catch {
    try {
      innovation = await fetchArxivBrowser(v.arxivCategory);
    } catch {
      failed.push("innovation");
    }
  }

  let patents: Entry[] = [];
  let funding: Entry[] = [];
  let news: Entry[] = [];
  if (WORKER_URL) {
    const q = `?vertical=${encodeURIComponent(v.id)}`;
    const [pRes, fRes, nRes] = await Promise.allSettled([
      fetch(`${WORKER_URL}/patents${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch(`${WORKER_URL}/funding${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch(`${WORKER_URL}/news${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    ]);
    if (pRes.status === "fulfilled") patents = pRes.value as Entry[]; else failed.push("patents");
    if (fRes.status === "fulfilled") funding = fRes.value as Entry[]; else failed.push("funding");
    if (nRes.status === "fulfilled") news = nRes.value as Entry[]; else failed.push("news");
  }

  return { entries: [...innovation, ...patents, ...funding, ...news], failed };
}

export default function App() {
  const [verticalId, setVerticalId] = useState(VERTICALS[0].id);
  const vertical = VERTICALS.find((v) => v.id === verticalId) ?? VERTICALS[0];
  const [data, setData] = useState<DataFile | null>(null);
  const [country, setCountry] = useState<string | "all">("all");
  const [mode, setMode] = useState<LiveMode>("loading");
  const [highlightOrg, setHighlightOrg] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setMode("loading");
    setCountry("all");
    setHighlightOrg(null);
    const dataUrl = `${import.meta.env.BASE_URL}data/${vertical.id}.json`;
    fetch(dataUrl)
      .then((r) => r.json() as Promise<DataFile>)
      .then((d) => {
        setData(d);
        setMode("static");
        refresh(); // layer a live read on top of the static build, once
      })
      .catch(() => setMode("fallback"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical.id]);

  async function refresh() {
    setMode("loading");
    try {
      const { entries: fresh, failed } = await fetchLive(vertical);
      setData((prev) => {
        const base = prev?.entries ?? [];
        const byId = new Map<string, Entry>();
        for (const e of [...base, ...fresh]) byId.set(e.id, e);
        return { technology: prev?.technology ?? vertical.id, generatedAt: new Date().toISOString(),
          entries: [...byId.values()], trend: prev?.trend ?? [], notes: prev?.notes ?? [] };
      });
      if (failed.length) console.warn(`live refresh: ${failed.join(", ")} unavailable, kept prior data for those`);
      setMode(fresh.length > 0 ? "refreshed" : "static");
    } catch { setMode(data ? "static" : "fallback"); }
  }

  const entries = data?.entries ?? [];
  const trend = data?.trend ?? [];
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
  const orgRows = useMemo(() => orgLeaderboard(entries, "innovation", 6), [entries]);

  const fundingTop = useMemo(() => topCountries(fundingByCountry(entries), 5), [entries]);
  const fundingGrandTotal = fundingTop.top.reduce((s, c) => s + c.count, 0) + fundingTop.rest.reduce((s, c) => s + c.count, 0) || 1;

  const STAGE_PIE_COLOR: Record<Stage, string> = { innovation: "var(--cn)", scaling: "var(--eu)", adoption: "var(--us)", investment: "var(--ink-2)" };

  // Real period-over-period deltas — null (and hidden) when there's no honest baseline.
  const totalPeriod = useMemo(() => STAGES.reduce((acc, s) => {
    const { current, previous } = periodCounts(entries, s.id, WINDOW_DAYS);
    return { current: acc.current + current, previous: acc.previous + previous };
  }, { current: 0, previous: 0 }), [entries]);
  const innovationPeriod = useMemo(() => periodCounts(entries, "innovation", WINDOW_DAYS), [entries]);
  const investmentPeriod = useMemo(() => periodCounts(entries, "investment", WINDOW_DAYS), [entries]);
  const fundingPeriod = useMemo(() => periodFunding(entries, WINDOW_DAYS), [entries]);

  // The headline comparison is "who leads, and by how much" — computed off
  // whichever two countries actually lead this vertical's innovation output,
  // not hardcoded to US/CN (that was a quantum-specific assumption that
  // doesn't generalize once other verticals with different leaders exist).
  const top2 = useMemo(() => topCountries(innovationCounts, 2).top, [innovationCounts]);
  const [leadCountry, runnerUp] = [top2[0]?.country, top2[1]?.country];
  const overallShares = useMemo(() => countryShares(innovationCounts), [innovationCounts]);
  const shareGap = leadCountry ? (overallShares[leadCountry] ?? 0) - (runnerUp ? overallShares[runnerUp] ?? 0 : 0) : 0;
  const gapTrendLabel = useMemo(() => {
    if (trend.length < 2 || !leadCountry) return null;
    const gapAt = (i: number) => {
      const s = countryShares(trend[i].counts);
      return (s[leadCountry] ?? 0) - (runnerUp ? s[runnerUp] ?? 0 : 0);
    };
    const diff = gapAt(trend.length - 1) - gapAt(0);
    return Math.abs(diff) < 0.5 ? "flat" : diff < 0 ? "narrowing" : "widening";
  }, [trend, leadCountry, runnerUp]);

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
  const statusText = mode === "loading" ? "syncing" : mode === "fallback" ? "data unavailable"
    : mode === "refreshed" ? "refreshed live" : "static build";

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
            <span className={mode === "refreshed" ? "on" : ""}>● {statusText}</span>
            <span>updated {generated}</span>
          </span>
        </div>
      </div>

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
          <span className="spacer" />
          <button className="ghost-btn" onClick={refresh}>↻ refresh live</button>
        </div>

        <div className="kpirow">
          <KpiCard
            highlight
            label="Total tracked entries"
            value={String(entries.length)}
            delta={fmtDelta(pctDelta(totalPeriod.current, totalPeriod.previous))}
            caption={`across all 4 stages · trailing ${WINDOW_DAYS}d vs prior`}
          />
          <KpiCard
            label="Innovation velocity"
            value={String(innovationPeriod.current)}
            delta={fmtDelta(pctDelta(innovationPeriod.current, innovationPeriod.previous))}
            caption={`works + patents, trailing ${WINDOW_DAYS}d`}
          />
          <KpiCard
            label={runnerUp ? `${countryName(leadCountry)} – ${countryName(runnerUp)} share gap` : "Leader share"}
            value={leadCountry ? `${leadCountry} +${Math.abs(shareGap).toFixed(0)}pt` : "—"}
            delta={gapTrendLabel}
            caption={gapTrendLabel ? `since ${trend[0]?.date}` : "not enough history yet"}
          />
          <KpiCard
            label="Open funding awards"
            value={String(investmentPeriod.current)}
            delta={fmtDelta(pctDelta(investmentPeriod.current, investmentPeriod.previous))}
            caption="NSF, disclosed only"
          />
          <KpiCard
            label="Disclosed investment"
            value={fmtUsd(fundingPeriod.current)}
            delta={fmtDelta(pctDelta(fundingPeriod.current, fundingPeriod.previous))}
            caption="US / EU only, no PRC feed"
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
              <VolumeTrend trend={trend} />
            </div>
          </div>
          <div className="panel map-panel">
            <h3>Where the work happens</h3>
            <div className="map-fill">
              <WorldMap counts={innovationCounts} onSelect={toggleCountry} active={country === "all" ? null : country} trend={trend} />
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
            <RecentEntries entries={shown} limit={6} />
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
          <TrendChart trend={trend} countries={forecastCountries} projectDays={daysToYearEnd} />
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
              />
            ))}
          </div>
        </section>

        <footer className="foot">
          <div className="h">Sources & method</div>
          Innovation streams from OpenAlex (institution country codes) with an arXiv fallback, plus EPO
          patents where a key is set. Scaling and adoption are curated in <code>data/{vertical.dataDir}/seed.ts</code> plus a
          live RSS layer. Investment is NSF Awards (US) — no equivalent public feed exists for China.
          Analyst notes live in <code>data/{vertical.dataDir}/notes.ts</code>. Every entry logs the real country an
          institution/awardee/filer is located in — country attribution is a lead, not a verdict. Forecast
          lines are a linear extrapolation of recorded trend points, not a measurement.
          <div className="sig">Ideas Advancing Freedom</div>
        </footer>
      </div>
    </>
  );
}
