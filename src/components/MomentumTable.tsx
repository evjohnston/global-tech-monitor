import { useMemo } from "react";
import type { Entry } from "../lib/types.ts";
import { countByCountry, countryShares, orgLeaderboard, concentrationShare, topCountries } from "../lib/aggregate.ts";
import { entriesAsOf, daysAgo } from "../lib/history.ts";
import { countryName } from "../lib/countries.ts";

const GROWTH_WINDOW_DAYS = 42;
const TOP_N = 8;

// Closes the guided story with several real dimensions of "leadership" side
// by side — current scale, recent growth, and how concentrated a country's
// own output is in one institution — so scale alone doesn't stand in as
// the only definition of who's ahead.
export function MomentumTable({ entries }: { entries: Entry[] }) {
  const rows = useMemo(() => {
    const counts = countByCountry(entries, "innovation");
    const currentShares = countryShares(counts);
    const past = entriesAsOf(entries, daysAgo(GROWTH_WINDOW_DAYS));
    const pastShares = countryShares(countByCountry(past, "innovation"));
    return topCountries(counts, TOP_N).top.map((c) => {
      const countryEntries = entries.filter((e) => e.country === c.country && e.stage === "innovation");
      const orgs = orgLeaderboard(countryEntries, undefined, 10);
      const { top1Pct } = concentrationShare(orgs, countryEntries.length);
      return {
        country: c.country,
        scale: c.count,
        growth: (currentShares[c.country] ?? 0) - (pastShares[c.country] ?? 0),
        concentration: top1Pct,
      };
    });
  }, [entries]);

  if (rows.length === 0) return <div className="trend-empty">Not enough tracked innovation output yet.</div>;

  return (
    <div>
      <table className="lb">
        <thead>
          <tr>
            <th>Country</th>
            <th className="right">Current scale</th>
            <th className="right">Recent growth</th>
            <th className="right">Concentration</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.country}>
              <td className="org-name">{countryName(r.country)}</td>
              <td className="right count">{r.scale}</td>
              <td className="right count">{Math.abs(r.growth) < 0.05 ? "flat" : `${r.growth > 0 ? "+" : "−"}${Math.abs(r.growth).toFixed(1)}pt`}</td>
              <td className="right count">{r.concentration.toFixed(0)}% top org</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cap">
        current scale = innovation-stage entries · recent growth = innovation-share point change over the trailing {GROWTH_WINDOW_DAYS} days ·
        concentration = share of that country's own tracked output held by its single leading institution
      </div>
    </div>
  );
}
