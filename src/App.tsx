import { useEffect, useMemo, useState } from "react";
import type { Actor, DataFile, Entry, Stage, StageNote } from "./lib/types.ts";
import { ACTORS, STAGES } from "./lib/types.ts";
import { inferActor } from "./lib/inferActor.ts";
import { countByActor, fundingByActor, orgLeaderboard } from "./lib/aggregate.ts";
import { StageColumn } from "./components/StageColumn.tsx";
import { TrendChart } from "./components/TrendChart.tsx";
import { CompareBars } from "./components/CompareBars.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";

type LiveMode = "loading" | "static" | "refreshed" | "fallback";
const DATA_URL = `${import.meta.env.BASE_URL}data.json`;
const ARXIV_URL =
  "https://export.arxiv.org/api/query?search_query=cat:quant-ph" +
  "&sortBy=submittedDate&sortOrder=descending&max_results=30";

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

export default function App() {
  const [data, setData] = useState<DataFile | null>(null);
  const [actor, setActor] = useState<Actor | "all">("all");
  const [mode, setMode] = useState<LiveMode>("loading");

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => r.json() as Promise<DataFile>)
      .then((d) => { setData(d); setMode("static"); })
      .catch(() => setMode("fallback"));
  }, []);

  async function refresh() {
    setMode("loading");
    try {
      const res = await fetch(ARXIV_URL);
      if (!res.ok) throw new Error(String(res.status));
      const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
      const nodes = [...xml.getElementsByTagName("entry")];
      const fresh: Entry[] = nodes.map((n) => {
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
      setData((prev) => {
        const base = prev?.entries ?? [];
        const byId = new Map<string, Entry>();
        for (const e of [...base, ...fresh]) byId.set(e.id, e);
        return { technology: prev?.technology ?? "quantum-computing", generatedAt: new Date().toISOString(),
          entries: [...byId.values()], trend: prev?.trend ?? [], notes: prev?.notes ?? [] };
      });
      setMode("refreshed");
    } catch { setMode(data ? "static" : "fallback"); }
  }

  const entries = data?.entries ?? [];
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

  // Hero comparison: research output (innovation stage) by actor, all entries.
  const innovationCounts = useMemo(() => countByActor(entries, "innovation"), [entries]);
  const orgRows = useMemo(() => orgLeaderboard(entries, "innovation", 8), [entries]);
  const funding = useMemo(() => fundingByActor(entries), [entries]);
  const hasFunding = Object.values(funding).some((v) => v > 0);

  const generated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const statusText = mode === "loading" ? "syncing" : mode === "fallback" ? "data unavailable"
    : mode === "refreshed" ? "refreshed live" : "nightly build";

  return (
    <>
      <div className="topbar">
        <div className="wrap topbar-inner">
          <span className="wordmark"><span className="gtm">GTM</span> / Global Tech Monitor</span>
          <span className="topbar-meta">
            <span>Vertical 01 · Quantum</span>
            <span className="on">● {statusText}</span>
            <span>updated {generated}</span>
          </span>
        </div>
      </div>

      <div className="wrap">
        <section className="hero">
          <div>
            <div className="hero-eyebrow">Research performance · quantum computing</div>
            <h1>Who leads, <em>and where</em></h1>
            <p className="hero-lede">
              A pipeline view of quantum computing from research through scaling, adoption, and public
              investment. Attribution comes from institution country data, not keyword guessing. Each
              stage names its source and marks live versus curated.
            </p>
          </div>
          <div>
            <div className="hero-viz-label">Research output by actor · innovation stage</div>
            <CompareBars counts={innovationCounts} />
          </div>
        </section>

        <div className="controls">
          <span className="lbl">Filter actor</span>
          <button className="chip" aria-pressed={actor === "all"} onClick={() => setActor("all")}>All</button>
          {ACTORS.map((a) => (
            <button key={a.id} className="chip" aria-pressed={actor === a.id} onClick={() => setActor(a.id)}>{a.label}</button>
          ))}
          <span className="spacer" />
          <button className="ghost-btn" onClick={refresh}>↻ refresh live</button>
        </div>

        <section className="section">
          <div className="section-kicker">
            <span className="idx">01</span>
            <h2>Research output over time</h2>
            <span className="sub">share by author-affiliation country</span>
          </div>
          <TrendChart trend={data?.trend ?? []} />
        </section>

        <section className="section">
          <div className="section-kicker">
            <span className="idx">02</span>
            <h2>Leading institutions</h2>
            <span className="sub">innovation stage · by output</span>
          </div>
          <Leaderboard rows={orgRows} unit="works" />
        </section>

        <section className="section">
          <div className="section-kicker">
            <span className="idx">03</span>
            <h2>The pipeline</h2>
            <span className="sub">research → scaling → adoption → investment</span>
          </div>
          <div className="pipeline">
            {STAGES.map((s) => (
              <StageColumn key={s.id} stage={s.id} entries={byStage[s.id]} note={latestNote[s.id]} />
            ))}
          </div>
        </section>

        {hasFunding && (
          <section className="section">
            <div className="section-kicker">
              <span className="idx">04</span>
              <h2>Public investment</h2>
              <span className="sub">disclosed research funding · US/EU only</span>
            </div>
            <CompareBars counts={funding} format={fmtUsd} />
            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mist)", marginTop: 14 }}>
              China's NSFC has no public machine-readable grants feed, so this view understates PRC funding.
              Read it as a floor on Western spending, not a complete comparison.
            </p>
          </section>
        )}

        <footer className="foot">
          <div className="h">Sources & method</div>
          Innovation streams from OpenAlex (institution country codes) with an arXiv fallback, plus EPO
          patents where a key is set. Scaling and adoption are curated in <code>data/seed.ts</code>.
          Investment is NSF Awards (US) — no equivalent public feed exists for China. Analyst notes live
          in <code>data/notes.ts</code>. Actor attribution is a lead, not a verdict.
          <div className="sig">Ideas Advancing Freedom</div>
        </footer>
      </div>
    </>
  );
}
