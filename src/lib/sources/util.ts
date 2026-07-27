export function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// Shared by every source that fetches a list of items one at a time with a
// gap between requests (massive.ts, usaSpending.ts, samGov.ts) — a real
// external API's rate limit is the reason for the gap in each case, so one
// implementation instead of a copy per source module.
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
