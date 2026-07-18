import { useEffect, useMemo, useState } from "react";
import type { Actor, DataFile, Entry, Stage } from "./lib/types.ts";
import { ACTORS, STAGES } from "./lib/types.ts";
import { inferActor } from "./lib/inferActor.ts";
import { StageColumn } from "./components/StageColumn.tsx";

type LiveMode = "loading" | "static" | "refreshed" | "fallback";

const DATA_URL = `${import.meta.env.BASE_URL}data.json`;
const ARXIV_URL =
  "https://export.arxiv.org/api/query?search_query=cat:quant-ph" +
  "&sortBy=submittedDate&sortOrder=descending&max_results=30";

export default function App() {
  const [data, setData] = useState<DataFile | null>(null);
  const [actor, setActor] = useState<Actor | "all">("all");
  const [mode, setMode] = useState<LiveMode>("loading");

  // Load the committed data file the Action produced.
  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => r.json() as Promise<DataFile>)
      .then((d) => {
        setData(d);
        setMode("static");
      })
      .catch(() => setMode("fallback"));
  }, []);

  // Optional browser-side live refresh. The committed file is the source of
  // truth; this just tops up innovation with the very newest preprints so a
  // visitor between nightly runs still sees today's papers.
  async function refresh() {
    setMode("loading");
    try {
      const res = await fetch(ARXIV_URL);
      if (!res.ok) throw new Error(String(res.status));
      const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
      const nodes = [...xml.getElementsByTagName("entry")];
      const fresh: Entry[] = nodes.map((n) => {
        const title = (n.getElementsByTagName("title")[0]?.textContent ?? "")
          .replace(/\s+/g, " ").trim();
        const pub = (n.getElementsByTagName("published")[0]?.textContent ?? "").slice(0, 10);
        const authors = [...n.getElementsByTagName("author")];
        const names = authors.map((a) => a.getElementsByTagName("name")[0]?.textContent ?? "");
        const affil = authors
          .map((a) => a.getElementsByTagName("arxiv:affiliation")[0]?.textContent ?? "")
          .join(" ");
        const org = names.length > 1 ? `${names[0]} et al.` : names[0] ?? "";
        const links = [...n.getElementsByTagName("link")];
        const url =
          links.find((l) => l.getAttribute("rel") === "alternate")?.getAttribute("href") ??
          n.getElementsByTagName("id")[0]?.textContent ??
          "https://arxiv.org/list/quant-ph/recent";
        const { actor: a, evidence } = inferActor(`${affil} ${org} ${title}`);
        const absId = url.split("/abs/")[1] ?? title.slice(0, 40);
        return {
          id: `arxiv-${absId}`, stage: "innovation", actor: a, provenance: "live",
          source: "arxiv", title, org, date: pub, url, actorEvidence: evidence,
        };
      });
      setData((prev) => {
        const base = prev?.entries ?? [];
        const byId = new Map<string, Entry>();
        for (const e of [...base, ...fresh]) byId.set(e.id, e);
        return {
          technology: prev?.technology ?? "quantum-computing",
          generatedAt: new Date().toISOString(),
          entries: [...byId.values()],
        };
      });
      setMode("refreshed");
    } catch {
      setMode(data ? "static" : "fallback");
    }
  }

  const filtered = useMemo(() => {
    const entries = data?.entries ?? [];
    const pass = actor === "all" ? entries : entries.filter((e) => e.actor === actor);
    const by: Record<Stage, Entry[]> = { innovation: [], scaling: [], adoption: [] };
    for (const e of pass) by[e.stage].push(e);
    // newest first within each stage
    for (const s of Object.keys(by) as Stage[]) {
      by[s].sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    return by;
  }, [data, actor]);

  const total = (data?.entries ?? []).filter(
    (e) => actor === "all" || e.actor === actor
  ).length;

  const statusText =
    mode === "loading" ? "loading data…"
    : mode === "fallback" ? "data file unavailable"
    : mode === "refreshed" ? "live · refreshed from arXiv"
    : "static · nightly build";

  const generated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  return (
    <>
      <div className="brandrule" />
      <div className="wrap">
        <header className="masthead">
          <div className="eyebrow">Global Tech Monitor · Vertical 01</div>
          <h1>
            Quantum computing, <span className="tech">end to end</span>
          </h1>
          <div className="tagline">from first principles to procurement</div>
          <p className="lede">
            A pipeline view of where quantum computing stands — research streaming
            live from arXiv, hardware and adoption milestones curated where no clean
            feed exists. Actor is inferred from affiliation and shown as a signal,
            not a verdict.
          </p>
          <div className="statusrow">
            <span className="status-live" data-mode={mode === "fallback" ? "fallback" : "live"}>
              <span className="dot" />
              {statusText}
            </span>
            <span>generated {generated}</span>
            <span>{total} entries shown</span>
          </div>
        </header>

        <div className="controls">
          <span className="label">Actor</span>
          <button
            className="chip"
            aria-pressed={actor === "all"}
            onClick={() => setActor("all")}
          >
            All
          </button>
          {ACTORS.map((a) => (
            <button
              key={a.id}
              className="chip"
              aria-pressed={actor === a.id}
              onClick={() => setActor(a.id)}
            >
              {a.label}
            </button>
          ))}
          <span className="spacer" />
          <button className="refresh" onClick={refresh}>
            ↻ refresh from arXiv
          </button>
        </div>

        <main className="pipeline">
          {STAGES.map((s) => (
            <StageColumn key={s.id} stage={s.id} entries={filtered[s.id]} />
          ))}
        </main>

        <footer className="foot">
          <div className="head">Sources &amp; method</div>
          Stage 01 is built nightly from the arXiv API (cat:quant-ph, newest first) and
          can be topped up live in the browser. Stages 02 and 03 are curated from public
          roadmaps and deployment reporting — the pipeline stages with no single queryable
          feed. Edit <code>data/seed.ts</code> to extend them. Actor inference reads
          affiliation strings and will misclassify; treat it as a lead, not a finding.
          <div className="tagline-foot">Ideas Advancing Freedom</div>
        </footer>
      </div>
    </>
  );
}
