export function KpiCard({
  label,
  value,
  delta,
  caption,
  highlight,
}: {
  label: string;
  value: string;
  delta?: string | null;
  caption: string;
  highlight?: boolean;
}) {
  return (
    <div className={`panel kpi${highlight ? " hi" : ""}`}>
      <div className="label">{label}</div>
      <div className="val num">
        {value}
        {delta && <span className="delta">{delta}</span>}
      </div>
      <div className="cap">{caption}</div>
    </div>
  );
}
