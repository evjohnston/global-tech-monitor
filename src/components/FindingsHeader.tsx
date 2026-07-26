import type { Entry } from "../lib/types.ts";
import { computeFindings, headline } from "../lib/findings.ts";
import { FindingCard } from "./FindingCard.tsx";

// The "open with the finding, not the interface" screen — a real headline
// and up to 4 cards derived from computeFindings (findings.ts), never
// selected because a number looked large. Omits cards/the headline outright
// when the underlying signal isn't real yet, rather than padding.
export function FindingsHeader({
  entries,
  generated,
  updatedAgo,
  coverageLabel,
}: {
  entries: Entry[];
  generated: string;
  updatedAgo: string | null;
  coverageLabel: string;
}) {
  const cards = computeFindings(entries);
  const headlineText = headline(cards);
  return (
    <div className="findings-header">
      {headlineText && <h1 className="finding-headline">{headlineText}</h1>}
      {cards.length > 0 && (
        <div className="finding-grid">
          {cards.map((c) => (
            <FindingCard key={c.key} card={c} />
          ))}
        </div>
      )}
      <div className="trend-note" style={{ marginTop: 8 }}>
        Last updated {generated}{updatedAgo ? ` · ${updatedAgo}` : ""} · {coverageLabel}
      </div>
    </div>
  );
}
