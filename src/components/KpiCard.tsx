export function KpiCard({
  label,
  value,
  delta,
  caption,
  highlight,
  span2,
}: {
  label: string;
  value: string;
  delta?: string | null;
  caption: string;
  highlight?: boolean;
  // Spans 2 grid columns — used by the country-filtered 5-unit metric row
  // (3 one-unit cards + 1 two-unit institution/organization card), where a
  // long institution name needs real room without breaking the row's
  // total width.
  span2?: boolean;
}) {
  return (
    <div className={`panel kpi${highlight ? " hi" : ""}${span2 ? " kpi-span2" : ""}`}>
      <div className="label">{label}</div>
      <div className="val num">
        {value}
        {delta && <span className="delta">{delta}</span>}
      </div>
      <div className="cap">{caption}</div>
    </div>
  );
}
