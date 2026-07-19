import { useEffect, useMemo, useState } from "react";
import type { Actor, DataFile, Entry, Stage, StageNote } from "./lib/types.ts";
import { ACTORS, STAGES } from "./lib/types.ts";
import { inferActor } from "./lib/inferActor.ts";
import { fetchOpenAlex } from "./lib/sources/openalex.ts";
import {
  ACTOR_LABEL, actorShares, countByActor, countByStage,
  orgLeaderboard, pctDelta, periodCounts, periodFunding,
} from "./lib/aggregate.ts";
import { StageColumn } from "./components/StageColumn.tsx";
import { TrendChart } from "./components/TrendChart.tsx";
import { VolumeTrend } from "./components/VolumeTrend.tsx";
import { BarRow } from "./components/BarRow.tsx";
import { KpiCard } from "./components/KpiCard.tsx";
import { MiniMap } from "./components/MiniMap.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";
import { RecentEntries } from "./components/RecentEntries.tsx";

type LiveMode = "loading" | "static" | "refreshed" | "fallback";
const DATA_URL = `${import.meta.env.BASE_URL}data.json`;
// The EPO/NSF proxy — see worker/. Unset in dev until you've deployed one
// and added VITE_WORKER_URL to .env.local; those two sources are just
// skipped (soft-fail) when it's not configured.
const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "");
const ARXIV_URL =
  "https://export.arxiv.org/api/query?search_query=cat:quant-ph" +
  "&sortBy=submittedDate&sortOrder=descending&max_results=30";
const ACTOR_VAR: Record<Actor, string> = {
  us: "var(--us)", cn: "var(--cn)", eu: "var(--eu)", other: "var(--other)",
};
const ACTOR_ORDER: Actor[] = ["us", "cn", "eu", "other"];
const WINDOW_DAYS = 21;

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
async function fetchArxivBrowser(): Promise<Entry[]> {
  const res = await fetch(ARXIV_URL);
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
      ?? n.getElementsByTagName("id")[0]?.textContent ?? "https://arxiv.org/list/quant-ph/recent";
    const { actor: a, evidence } = inferActor(`${affil} ${org} ${title}`);
    const absId = url.split("/abs/")[1] ?? title.slice(0, 40);
    return { id: `arxiv-${absId}`, stage: "innovation" as Stage, actor: a, provenance: "live" as const,
      source: "arxiv" as const, title, org, date: pub, url, actorEvidence: evidence };
  });
}

// One fresh read across every source that can be fetched from the browser
// (OpenAlex direct) or through the worker proxy (EPO, NSF). Each leg fails
// soft — same ethos as the nightly build — so one dead source never blanks
// the others.
async function fetchLive(): Promise<{ entries: Entry[]; failed: string[] }> {
  const failed: string[] = [];
  let innovation: Entry[] = [];
  try {
    innovation = await fetchOpenAlex({ mailto: "gtm@example.com" });
  } catch {
    try {
      innovation = await fetchArxivBrowser();
    } catch {
      failed.push("innovation");
    }
  }

  let patents: Entry[] = [];
  let funding: Entry[] = [];
  if (WORKER_URL) {
    const [pRes, fRes] = await Promise.allSettled([
      fetch(`${WORKER_URL}/patents`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch(`${WORKER_URL}/funding`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    ]);
    if (pRes.status === "fulfilled") patents = pRes.value as Entry[]; else failed.push("patents");
    if (fRes.status === "fulfilled") funding = fRes.value as Entry[]; else failed.push("funding");
  }

  return { entries: [...innovation, ...patents, ...funding], failed };
}

export default function App() {
  const [data, setData] = useState<DataFile | null>(null);
  const [actor, setActor] = useState<Actor | "all">("all");
  const [mode, setMode] = useState<LiveMode>("loading");
  const [highlightOrg, setHighlightOrg] = useState<string | null>(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => r.json() as Promise<DataFile>)
      .then((d) => {
        setData(d);
        setMode("static");
        refresh(); // layer a live read on top of the static build, once
      })
      .catch(() => setMode("fallback"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setMode("loading");
    try {
      const { entries: fresh, failed } = await fetchLive();
      setData((prev) => {
        const base = prev?.entries ?? [];
        const byId = new Map<string, Entry>();
        for (const e of [...base, ...fresh]) byId.set(e.id, e);
        return { technology: prev?.technology ?? "quantum-computing", generatedAt: new Date().toISOString(),
          entries: [...byId.values()], trend: prev?.trend ?? [], notes: prev?.notes ?? [] };
      });
      if (failed.length) console.warn(`live refresh: ${failed.join(", ")} unavailable, kept prior data for those`);
      setMode(fresh.length > 0 ? "refreshed" : "static");
    } catch { setMode(data ? "static" : "fallback"); }
  }

  const entries = data?.entries ?? [];
  const trend = data?.trend ?? [];
  const shown = actor === "all" ? entries : entries.filter((e) => e.actor === actor);

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

  const innovationCounts = useMemo(() => countByActor(entries, "innovation"), [entries]);
  const innovationShares = useMemo(() => actorShares(innovationCounts), [innovationCounts]);
  const stageCounts = useMemo(() => countByStage(entries), [entries]);
  const stageTotal = Object.values(stageCounts).reduce((s, n) => s + n, 0) || 1;
  const orgRows = useMemo(() => orgLeaderboard(entries, "innovation", 6), [entries]);

  // Real period-over-period deltas — null (and hidden) when there's no honest baseline.
  const totalPeriod = useMemo(() => STAGES.reduce((acc, s) => {
    const { current, previous } = periodCounts(entries, s.id, WINDOW_DAYS);
    return { current: acc.current + current, previous: acc.previous + previous };
  }, { current: 0, previous: 0 }), [entries]);
  const innovationPeriod = useMemo(() => periodCounts(entries, "innovation", WINDOW_DAYS), [entries]);
  const investmentPeriod = useMemo(() => periodCounts(entries, "investment", WINDOW_DAYS), [entries]);
  const fundingPeriod = useMemo(() => periodFunding(entries, WINDOW_DAYS), [entries]);
  const shareGap = innovationShares.us - innovationShares.cn;
  const shareGapLeader = shareGap >= 0 ? "US" : "CN";
  const gapTrendLabel = useMemo(() => {
    if (trend.length < 2) return null;
    const gapAt = (i: number) => {
      const s = actorShares(trend[i].counts);
      return s.us - s.cn;
    };
    const diff = gapAt(trend.length - 1) - gapAt(0);
    return Math.abs(diff) < 0.5 ? "flat" : diff < 0 ? "narrowing" : "widening";
  }, [trend]);

  const generated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const statusText = mode === "loading" ? "syncing" : mode === "fallback" ? "data unavailable"
    : mode === "refreshed" ? "refreshed live" : "static build";

  function toggleActor(a: Actor) {
    setActor((prev) => (prev === a ? "all" : a));
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
          <span className="topbar-meta">
            <span>Vertical 01 · Quantum</span>
            <span className={mode === "refreshed" ? "on" : ""}>● {statusText}</span>
            <span>updated {generated}</span>
          </span>
        </div>
      </div>

      <div className="wrap">
        <div className="pagehead">
          <div>
            <h1>Global Tech Monitor</h1>
            <div className="sub">Quantum computing · innovation, scaling, adoption, investment</div>
          </div>
        </div>

        <div className="controls">
          <span className="lbl">Filter actor</span>
          <button className="chip" aria-pressed={actor === "all"} onClick={() => setActor("all")}>All</button>
          {ACTORS.map((a) => (
            <button key={a.id} className="chip" aria-pressed={actor === a.id} onClick={() => toggleActor(a.id)}>{a.label}</button>
          ))}
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
            label="US – CN share gap"
            value={`${shareGapLeader} +${Math.abs(shareGap).toFixed(0)}pt`}
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

        <div className="row3">
          <div className="panel">
            <h3>Innovation output over time</h3>
            <VolumeTrend trend={trend} />
          </div>
          <div className="panel">
            <h3>Output by actor · innovation stage</h3>
            {ACTOR_ORDER.map((a) => (
              <BarRow
                key={a}
                label={ACTOR_LABEL[a]}
                pct={innovationShares[a]}
                color={ACTOR_VAR[a]}
                valueLabel={`${innovationCounts[a]} · ${innovationShares[a].toFixed(0)}%`}
                detail={`${innovationCounts[a]} works · ${innovationShares[a].toFixed(1)}% of innovation output · click to filter`}
                onClick={() => toggleActor(a)}
                active={actor === a}
              />
            ))}
          </div>
          <div className="panel">
            <h3>Where the work happens</h3>
            <MiniMap counts={innovationCounts} onSelect={toggleActor} active={actor} />
            <div className="maplegend"><span className="dot" />High volume<span className="dot sm" style={{ marginLeft: 8 }} />Low volume</div>
          </div>
        </div>

        <div className="row3">
          <div className="panel">
            <h3>Entries by stage</h3>
            {STAGES.map((s) => (
              <BarRow
                key={s.id}
                label={s.label}
                pct={(stageCounts[s.id] / stageTotal) * 100}
                color="var(--ink-2)"
                valueLabel={`${stageCounts[s.id]} · ${((stageCounts[s.id] / stageTotal) * 100).toFixed(0)}%`}
                detail={`${stageCounts[s.id]} entries · ${((stageCounts[s.id] / stageTotal) * 100).toFixed(1)}% of tracked total · click to jump`}
                onClick={() => scrollToStage(s.id)}
              />
            ))}
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
          <h3>Actor share forecast <span className="fc-tag">Projected — linear trend</span></h3>
          <TrendChart trend={trend} />
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
          patents where a key is set. Scaling and adoption are curated in <code>data/seed.ts</code>.
          Investment is NSF Awards (US) — no equivalent public feed exists for China. Analyst notes live
          in <code>data/notes.ts</code>. Actor attribution is a lead, not a verdict. Forecast lines are a
          linear extrapolation of recorded trend points, not a measurement.
          <div className="sig">Ideas Advancing Freedom</div>
        </footer>
      </div>
    </>
  );
}
