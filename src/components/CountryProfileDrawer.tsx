import { useEffect, useMemo } from "react";
import type { Entry, TrendPoint } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { countByCountry, countryShares, orgLeaderboard, rankOf } from "../lib/aggregate.ts";
import { entriesAsOf, daysAgo } from "../lib/history.ts";
import { countryColor, countryName } from "../lib/countries.ts";

const RANK_CHANGE_WINDOW_DAYS = 42;

// Real content only, same "omit rather than fabricate" discipline as the
// rest of this app — every number here comes straight from countByCountry/
// countByCountryAndStage/orgLeaderboard/rankOf, nothing generated. Same
// Escape/backdrop-close overlay pattern as EntryModal.tsx.
export function CountryProfileDrawer({
  country,
  entries,
  trend,
  compareCountries,
  onClose,
  onFilter,
  onToggleCompare,
}: {
  country: string;
  entries: Entry[];
  trend: TrendPoint[];
  compareCountries: string[];
  onClose: () => void;
  onFilter: (country: string) => void;
  onToggleCompare: (country: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const innovationCounts = useMemo(() => countByCountry(entries, "innovation"), [entries]);
  const rank = rankOf(innovationCounts, country);
  const pastCounts = useMemo(
    () => countByCountry(entriesAsOf(entries, daysAgo(RANK_CHANGE_WINDOW_DAYS)), "innovation"),
    [entries]
  );
  const pastRank = rankOf(pastCounts, country);
  const rankChange = rank != null && pastRank != null ? pastRank - rank : null; // positive = improved

  const strengths = STAGES.map((s) => {
    const counts = countByCountry(entries, s.id);
    const shares = countryShares(counts);
    const nCountries = Object.keys(counts).length || 1;
    const avgShare = 100 / nCountries;
    const share = shares[country] ?? 0;
    return { stage: s.id, label: s.label, share, avgShare, relative: share - avgShare };
  }).filter((s) => s.share > 0);

  const strongest = [...strengths].sort((a, b) => b.relative - a.relative).slice(0, 2);
  const weakest = strengths.length > 2 ? [...strengths].sort((a, b) => a.relative - b.relative).slice(0, 2) : [];

  const countryEntries = entries.filter((e) => e.country === country);
  const topOrgs = orgLeaderboard(countryEntries, undefined, 5);

  const sparkline = trend.slice(-21).map((p) => p.counts[country] ?? 0);
  const sparkMax = Math.max(1, ...sparkline);
  const inComparison = compareCountries.includes(country);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        <div className="drawer-flag" style={{ background: countryColor(country) }} />
        <h2>{countryName(country)}</h2>
        <div className="trend-note" style={{ marginBottom: 12 }}>
          {rank != null ? `#${rank} in tracked innovation output` : "No tracked innovation output yet"}
          {rankChange != null && rankChange !== 0 && (
            <> · {rankChange > 0 ? `up ${rankChange}` : `down ${Math.abs(rankChange)}`} over the trailing {RANK_CHANGE_WINDOW_DAYS} days</>
          )}
        </div>

        {sparkline.some((v) => v > 0) && (
          <svg viewBox="0 0 200 40" width="100%" height={40} style={{ marginBottom: 12, display: "block" }}>
            <polyline
              fill="none"
              stroke={countryColor(country)}
              strokeWidth={2}
              points={sparkline
                .map((v, i) => `${(i / Math.max(1, sparkline.length - 1)) * 200},${40 - (v / sparkMax) * 36}`)
                .join(" ")}
            />
          </svg>
        )}

        {strongest.length > 0 && (
          <>
            <div className="drawer-label">Relative strength</div>
            <ul className="drawer-list">
              {strongest.map((s) => (
                <li key={s.stage}>{s.label}: {s.share.toFixed(1)}% share (avg {s.avgShare.toFixed(1)}%)</li>
              ))}
            </ul>
          </>
        )}
        {weakest.length > 0 && (
          <>
            <div className="drawer-label">Trails its overall position in</div>
            <ul className="drawer-list">
              {weakest.map((s) => (
                <li key={s.stage}>{s.label}: {s.share.toFixed(1)}% share (avg {s.avgShare.toFixed(1)}%)</li>
              ))}
            </ul>
          </>
        )}

        {topOrgs.length > 0 && (
          <>
            <div className="drawer-label">Leading institutions</div>
            <ul className="drawer-list">
              {topOrgs.map((o) => (
                <li key={o.org}>{o.org} · {o.count}</li>
              ))}
            </ul>
          </>
        )}

        <div className="drawer-actions">
          <button className="pill primary" onClick={() => { onFilter(country); onClose(); }}>
            Filter page to {countryName(country)} →
          </button>
          <button className="chip" aria-pressed={inComparison} onClick={() => onToggleCompare(country)}>
            {inComparison ? "Remove from comparison" : "Add to comparison"}
          </button>
        </div>
      </aside>
    </div>
  );
}
