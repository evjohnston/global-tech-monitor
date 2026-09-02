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

// Every source module's `abstract` goes through here. Entry.abstract is
// documented as detail-popup enrichment (see types.ts) and has exactly two
// consumers — the metadata drawer's paragraph and news.ts's search text —
// so it never needed to be stored in full, and storing it in full was
// quietly the single largest thing in this app's payload. Measured
// 2026-09-02 on the real quantum data file: abstracts were 12.39MB of an
// 17.9MB entries[] array, 69.4% of everything, at a median length of 1,496
// characters. Capping at 600 keeps a genuinely readable ~90-word opening
// and cuts two thirds of that, which is what makes it affordable to raise
// the OpenAlex page count far enough to actually cover the AI and biotech
// corpora instead of sampling 6% of them (see OA_PAGES in
// scripts/fetch-data.ts).
//
// Cuts on a word boundary and marks the cut with an ellipsis, so a reader
// can see the text is abridged rather than wondering why an abstract stops
// mid-sentence — the source URL is right there in the same drawer.
const ABSTRACT_MAX = 600;

export function truncateAbstract(raw: string | undefined, max = ABSTRACT_MAX): string | undefined {
  const text = raw?.trim();
  if (!text) return undefined;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
