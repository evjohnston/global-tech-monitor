import { countryName } from "../lib/countries.ts";

// The one shared filter bar every dashboard reads from — country, date
// range, and whatever comparison countries are active, plus a reset. State
// itself lives in App.tsx (it has to: every dashboard and the URL both
// read it), this component is purely the control surface, kept in one
// place so its behavior can't drift between pages.
export function DashboardFilters({
  country,
  onSetCountry,
  availableCountries,
  dateFrom,
  dateTo,
  onSetDateFrom,
  onSetDateTo,
  onClearDate,
  compareCountries,
  onClearCountry,
  onCopyLink,
  onResetDashboard,
  technologyLabel,
}: {
  country: string;
  onSetCountry: (c: string) => void;
  availableCountries: string[];
  dateFrom: string | null;
  dateTo: string | null;
  onSetDateFrom: (v: string | null) => void;
  onSetDateTo: (v: string | null) => void;
  onClearDate: () => void;
  compareCountries: string[];
  onClearCountry: () => void;
  onCopyLink: () => void;
  onResetDashboard: () => void;
  technologyLabel: string;
}) {
  const hasCountry = country !== "all";
  const hasDate = !!dateFrom || !!dateTo;
  const hasAnyFilter = hasCountry || hasDate || compareCountries.length > 0;
  const summary: string[] = [];
  if (compareCountries.length > 0) summary.push(compareCountries.map((c) => countryName(c)).join(" × "));
  else if (hasCountry) summary.push(countryName(country));
  if (hasDate) summary.push(`${dateFrom ?? "…"}–${dateTo ?? "…"}`);
  summary.push(technologyLabel);

  return (
    <div className="selection-bar" role="group" aria-label="Shared filters">
      <span className="selection-bar-label">Filters</span>
      <label className="sr-only" htmlFor="country-filter">Country</label>
      <select id="country-filter" className="country-filter-select" value={country} onChange={(e) => onSetCountry(e.target.value)}>
        <option value="all">All countries</option>
        {availableCountries.map((c) => (
          <option key={c} value={c}>{countryName(c)}</option>
        ))}
      </select>
      <span className="date-input">
        <label className="sr-only" htmlFor="date-from">From date</label>
        <input id="date-from" type="date" value={dateFrom ?? ""} onChange={(e) => onSetDateFrom(e.target.value || null)} />
      </span>
      <span className="date-input">
        <label className="sr-only" htmlFor="date-to">To date</label>
        <input id="date-to" type="date" value={dateTo ?? ""} onChange={(e) => onSetDateTo(e.target.value || null)} />
      </span>
      {hasAnyFilter && <span className="selection-bar-value">{summary.join(" · ")}</span>}
      <span className="spacer" />
      {hasCountry && <button className="chip" onClick={onClearCountry}>Clear country</button>}
      {hasDate && <button className="chip" onClick={onClearDate}>Clear date</button>}
      {hasAnyFilter && <button className="chip" onClick={onCopyLink}>Copy link</button>}
      {hasAnyFilter && <button className="chip" onClick={onResetDashboard}>Reset filters</button>}
    </div>
  );
}
