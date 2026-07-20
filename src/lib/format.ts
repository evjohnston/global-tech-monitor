// Compact USD formatting — shared by the KPI row, entry cards, and the
// entry detail modal so the $1.2M / $340K rounding rule can't drift between
// them (Card/EntryModal's copies were missing the billions case App.tsx's
// had). Takes a definite number; callers decide whether a missing/zero
// amount should hide the value entirely or display as "$0" — that's a
// presentation choice, not a formatting one.
export function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}
