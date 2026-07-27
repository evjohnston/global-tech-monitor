import { useMemo, useState } from "react";
import type { Entry } from "../lib/types.ts";
import type { Dashboard } from "../lib/urlState.ts";
import { countryName } from "../lib/countries.ts";
import { dedupeNews, isNewsEntry, newsCategory, newsFreshnessLabel, rankNewsForTrack, type NewsGroup } from "../lib/news.ts";
import { usePrefersReducedMotion } from "../lib/useReducedMotion.ts";

const CATEGORY_COLOR: Record<string, string> = {
  Policy: "var(--eu)", Research: "var(--cn)", Scaling: "var(--eu)", Adoption: "var(--us)",
  Funding: "var(--slate)", Company: "var(--slate)", Security: "var(--red)", International: "var(--other)", News: "var(--mist)",
};

const LIMIT = 20;
const NUDGE_PX = 280; // one item-ish width — prev/next steps the paused track by roughly one story

// Real breaking-news reporting only — provenance:"auto" entries (RSS trade
// press, Google News), never a raw paper/patent/grant/hand-verified
// milestone row. Ranked per the active track/country (see news.ts), not
// just most-recent-first, and deduplicated so the same event reported by
// several outlets shows once with a "+N sources" note. Continuously
// scrolling marquee by default (the motion itself is the point — this is
// a "breaking news" strip, not a static list) — pauses on hover/focus/
// explicit pause, offers prev/next to nudge through it while paused, and
// degrades to a static scrollable list under prefers-reduced-motion.
export function NewsTicker({
  entries,
  dashboard,
  country,
  updatedAgo,
  onSelect,
  onViewAll,
}: {
  entries: Entry[];
  dashboard: Dashboard;
  country: string | "all";
  updatedAgo?: string | null;
  onSelect?: (entry: Entry) => void;
  onViewAll?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [manualOffsetPx, setManualOffsetPx] = useState(0);

  // Shared by both the country-scoped ranking and its fallback below — the
  // filter+dedupe step doesn't depend on dashboard/country, so it only
  // needs to run once per real entries[] change, not once per ranking.
  const deduped = useMemo(() => dedupeNews(entries.filter(isNewsEntry)), [entries]);

  const groups = useMemo(
    () => rankNewsForTrack(deduped, { dashboard, country: country === "all" ? null : country }).slice(0, LIMIT),
    [deduped, dashboard, country]
  );

  const usingFallback = groups.length < 4 && country !== "all";
  const fallbackGroups = useMemo(() => {
    if (!usingFallback) return [];
    return rankNewsForTrack(deduped, { dashboard, country: null }).slice(0, LIMIT);
  }, [usingFallback, deduped, dashboard]);
  const visible = usingFallback ? fallbackGroups : groups;

  if (visible.length === 0) {
    return (
      <div className="ticker">
        <span className="ticker-label">Breaking</span>
        <div className="ticker-empty">No matching news was found in the last seven days. Showing the latest available stories when they arrive.</div>
        {onViewAll && <button className="ticker-ctrl" onClick={onViewAll}>View all news</button>}
      </div>
    );
  }

  function Item({ g, dupKey }: { g: NewsGroup; dupKey: string }) {
    const e = g.primary;
    const cat = newsCategory(e);
    return (
      <span className="ticker-item" key={dupKey}>
        <span className="ticker-tag" style={{ background: CATEGORY_COLOR[cat] }}>{cat}</span>
        <button className="ticker-link" onClick={() => onSelect?.(e)} title={e.publisher ? `via ${e.publisher}` : undefined}>{e.title}</button>
        {e.country && <span className="ticker-sep">· {countryName(e.country)}</span>}
        <span className="ticker-sep">· {newsFreshnessLabel(e.date)}</span>
        {g.alsoReportedBy.length > 0 && <span className="ticker-also">+{g.alsoReportedBy.length} sources</span>}
        <span className="ticker-sep">●</span>
      </span>
    );
  }

  // Reduced motion: a static, horizontally scrollable list — never an
  // auto-advancing marquee for those users.
  if (reducedMotion) {
    return (
      <div className="ticker ticker-static">
        <span className="ticker-label">Breaking</span>
        <div className="ticker-static-list" role="list">
          {visible.map((g) => <div role="listitem" key={g.primary.id}><Item g={g} dupKey={g.primary.id} /></div>)}
        </div>
        {usingFallback && <span className="ticker-fallback-note">More global news</span>}
        {updatedAgo && <span className="ticker-fallback-note">Updated {updatedAgo}</span>}
        {onViewAll && <button className="ticker-ctrl" onClick={onViewAll}>View all news</button>}
      </div>
    );
  }

  const paused = !playing || hovering || manualOffsetPx !== 0;

  return (
    <div className="ticker" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} onFocus={() => setHovering(true)} onBlur={() => setHovering(false)}>
      <span className="ticker-label"><span className="live-dot" />Breaking</span>
      <button className="ticker-ctrl" aria-label="Previous story" onClick={() => setManualOffsetPx((p) => p + NUDGE_PX)}>‹</button>
      <div className="ticker-track-wrap">
        <div
          className={`ticker-track${paused ? " paused" : ""}`}
          style={{ animationDuration: `${Math.max(20, visible.length * 4)}s`, transform: manualOffsetPx ? `translateX(${-manualOffsetPx}px)` : undefined }}
        >
          {visible.map((g) => <Item key={`a-${g.primary.id}`} g={g} dupKey={`a-${g.primary.id}`} />)}
          {visible.map((g) => <Item key={`b-${g.primary.id}`} g={g} dupKey={`b-${g.primary.id}`} />)}
        </div>
      </div>
      <button className="ticker-ctrl" aria-label="Next story" onClick={() => setManualOffsetPx((p) => Math.max(0, p - NUDGE_PX))}>›</button>
      <button
        className="ticker-ctrl"
        aria-pressed={playing}
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => { setManualOffsetPx(0); setPlaying((p) => !p); }}
      >
        {playing && manualOffsetPx === 0 ? "⏸" : "▶"}
      </button>
      {usingFallback && <span className="ticker-fallback-note">More global news</span>}
      {updatedAgo && <span className="ticker-fallback-note">Updated {updatedAgo}</span>}
      {onViewAll && <button className="ticker-ctrl" onClick={onViewAll}>View all news</button>}
    </div>
  );
}
