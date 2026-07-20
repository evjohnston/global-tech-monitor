import type { Entry, Stage } from "../lib/types.ts";
import { countryName } from "../lib/countries.ts";

const STAGE_TAG_COLOR: Record<Stage, string> = {
  innovation: "var(--cn)", scaling: "var(--eu)", adoption: "var(--us)", investment: "var(--slate)",
};
const STAGE_SHORT: Record<Stage, string> = {
  innovation: "innovation", scaling: "scaling", adoption: "adoption", investment: "investment",
};

// Real recent activity across the whole pipeline, most-recent-first — not a
// fabricated feed. Rendered twice back to back so the CSS scroll loop has
// no visible seam; speed scales with item count so it doesn't race by on a
// short list or crawl on a long one.
export function NewsTicker({ entries, limit = 18 }: { entries: Entry[]; limit?: number }) {
  const recent = [...entries]
    .filter((e) => e.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);

  if (recent.length === 0) return null;

  const items = (key: "a" | "b") =>
    recent.map((e, i) => (
      <span className="ticker-item" key={`${key}-${e.id}-${i}`}>
        <span className="ticker-tag" style={{ background: STAGE_TAG_COLOR[e.stage] }}>{STAGE_SHORT[e.stage]}</span>
        <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a>
        {e.country && <span className="ticker-sep">· {countryName(e.country)}</span>}
        <span className="ticker-sep">●</span>
      </span>
    ));

  return (
    <div className="ticker">
      <span className="ticker-label"><span className="live-dot" />Latest</span>
      <div className="ticker-track-wrap">
        <div className="ticker-track" style={{ animationDuration: `${Math.max(20, recent.length * 4)}s` }}>
          {items("a")}
          {items("b")}
        </div>
      </div>
    </div>
  );
}
