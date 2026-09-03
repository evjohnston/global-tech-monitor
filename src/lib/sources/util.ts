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
// Lowered 600 -> 240 on 2026-09-03. Measured on the real shipped AI file:
// `abstract` was 8.00 MB of a 21.75 MB payload, 36.8% of everything, and the
// single largest field by a wide margin. Capping at 240 takes the whole file
// from 5.80 MB gzipped to 4.10 MB, a 29% cut, without dropping a single
// entry — which matters because dropping entries would change whether
// "output by country" means all-time or a rolling window, and that is a
// claim about what this instrument measures, not a storage decision.
//
// 240 costs the hand-curated entries nothing, checked before choosing it:
// deployment abstracts average 255 characters, milestones 344, news 101, so
// the cap barely touches them. The 4.20 MB it does remove is almost entirely
// machine-fetched paper/grant/patent abstracts, where the field is a
// convenience preview beside a source link rather than the content itself.
const ABSTRACT_MAX = 240;

export function truncateAbstract(raw: string | undefined, max = ABSTRACT_MAX): string | undefined {
  const text = raw?.trim();
  if (!text) return undefined;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
