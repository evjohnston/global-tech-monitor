import { useState, type ReactNode } from "react";
import { Tooltip } from "./Tooltip.tsx";

export function BarRow({
  label,
  pct,
  color,
  valueLabel,
  detail,
  onClick,
  active,
}: {
  label: string;
  pct: number;
  color: string;
  valueLabel: string;
  detail: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  return (
    <div
      className={`barrow${onClick ? " clickable" : ""}${active ? " active" : ""}`}
      onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTip(null)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <span className="name">{label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="v num">{valueLabel}</span>
      {tip && <Tooltip x={tip.x} y={tip.y}>{detail}</Tooltip>}
    </div>
  );
}
