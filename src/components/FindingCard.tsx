import type { FindingCard as FindingCardData } from "../lib/findings.ts";

export function FindingCard({ card }: { card: FindingCardData }) {
  return (
    <div className="panel finding-card">
      <div className="finding-label">{card.label}</div>
      <div className="finding-value">{card.value}</div>
      {card.deltaLabel && <div className="finding-delta">{card.deltaLabel}</div>}
      <div className="finding-context">{card.context}</div>
    </div>
  );
}
