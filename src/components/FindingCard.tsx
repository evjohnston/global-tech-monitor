import type { FindingCard as FindingCardData } from "../lib/findings.ts";

export function FindingCard({ card, onSelect }: { card: FindingCardData; onSelect?: (card: FindingCardData) => void }) {
  const clickable = !!onSelect;
  return (
    <div
      className={`panel finding-card${clickable ? " clickable" : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${card.label}: ${card.value}. ${card.context}` : undefined}
      onClick={clickable ? () => onSelect!(card) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect!(card); } } : undefined}
    >
      <div className="finding-label">{card.label}</div>
      <div className="finding-value">{card.value}</div>
      {card.deltaLabel && <div className="finding-delta">{card.deltaLabel}</div>}
      <div className="finding-context">{card.context}</div>
    </div>
  );
}
