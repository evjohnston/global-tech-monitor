import type { Entry } from "./types.ts";

// The one primitive that makes "as of N days ago" real rather than requiring
// a new stored-history field: since every real Entry already carries a date,
// filtering to date <= cutoff reconstructs the exact corpus that existed at
// any past moment, for ANY stage/source combination — not just innovation,
// which is the only stage trend[] tracks per-country history for today.
// Coarse YYYY-MM seed entries parse to the 1st of that month (same
// convention aggregate.ts's periodCounts/periodFunding already document).
export function entriesAsOf(entries: Entry[], cutoff: Date | string): Entry[] {
  const cutoffMs = (cutoff instanceof Date ? cutoff : new Date(cutoff)).getTime();
  return entries.filter((e) => {
    if (!e.date) return false;
    const d = new Date(e.date).getTime();
    return !Number.isNaN(d) && d <= cutoffMs;
  });
}

export function daysAgo(n: number, now = new Date()): Date {
  return new Date(now.getTime() - n * 86_400_000);
}
