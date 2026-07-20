import type { Entry } from "../lib/types.ts";

interface Bucket { label: string; test: (amt: number) => boolean }

const BUCKETS: Bucket[] = [
  { label: "<$100K", test: (a) => a < 100_000 },
  { label: "$100–250K", test: (a) => a >= 100_000 && a < 250_000 },
  { label: "$250–500K", test: (a) => a >= 250_000 && a < 500_000 },
  { label: "$500K–1M", test: (a) => a >= 500_000 && a < 1_000_000 },
  { label: ">$1M", test: (a) => a >= 1_000_000 },
];

// Makes the existing analyst point ("NSF funding is a footnote next to
// hyperscaler capex") visible as a shape, not just a caveat the reader has
// to take on faith. NSF grants only — this app has no line-item source for
// private capex, so it's never mixed into the same series; if you want to
// gesture at the scale gap, do it as a separate labeled annotation sourced
// to a real disclosed figure, not a bar in this histogram (see
// gtm-claude-code-spec.md Part 5).
export function AwardSizeHistogram({ entries }: { entries: Entry[] }) {
  const amounts = entries
    .filter((e) => e.source === "grant" && typeof e.amountUsd === "number")
    .map((e) => e.amountUsd as number);

  if (amounts.length === 0) {
    return <div className="trend-empty">No disclosed award amounts yet.</div>;
  }

  const counts = BUCKETS.map((b) => amounts.filter(b.test).length);
  const max = Math.max(1, ...counts);

  return (
    <div className="histogram">
      {BUCKETS.map((b, i) => (
        <div key={b.label} className="histogram-col">
          <div className="histogram-count num">{counts[i]}</div>
          <div className="histogram-bar-track">
            <div className="histogram-bar" style={{ height: `${(counts[i] / max) * 100}%` }} />
          </div>
          <div className="histogram-label">{b.label}</div>
        </div>
      ))}
    </div>
  );
}
