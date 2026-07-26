import type { Stage } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { countryName } from "../lib/countries.ts";

// One persistent strip summarizing whatever is currently active — the
// compare set, the single country/stage filter, and the date range — so a
// reader never has to guess what's driving what they're seeing, and always
// has one visible way out ("Clear all").
export function SelectionBar({
  compareCountries,
  country,
  stage,
  from,
  to,
  onClearAll,
  onCopyLink,
}: {
  compareCountries: string[];
  country: string | "all";
  stage: Stage | "all";
  from: string | null;
  to: string | null;
  onClearAll: () => void;
  onCopyLink: () => void;
}) {
  const hasSelection = compareCountries.length > 0 || country !== "all" || stage !== "all" || !!from || !!to;
  if (!hasSelection) return null;

  const parts: string[] = [];
  if (compareCountries.length > 0) parts.push(compareCountries.map((c) => countryName(c)).join(" × "));
  else if (country !== "all") parts.push(countryName(country));
  if (stage !== "all") parts.push(STAGES.find((s) => s.id === stage)!.label);
  if (from || to) parts.push(`${from ?? "…"} – ${to ?? "…"}`);

  return (
    <div className="selection-bar" role="status">
      <span className="selection-bar-label">{compareCountries.length > 0 ? "Comparing:" : "Active:"}</span>
      <span className="selection-bar-value">{parts.join(" · ")}</span>
      <span className="spacer" />
      <button className="chip" onClick={onCopyLink}>Copy link</button>
      <button className="chip" onClick={onClearAll}>Clear all</button>
    </div>
  );
}
