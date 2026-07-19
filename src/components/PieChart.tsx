import { useState } from "react";
import { Tooltip } from "./Tooltip.tsx";

export interface PieSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  detail: string;
}

// Simple SVG pie — no library, matches the rest of this app's hand-rolled
// charts. Slices are ordered as given (caller decides, usually by size).
export function PieChart({ slices, onSelect }: { slices: PieSlice[]; onSelect?: (key: string) => void }) {
  const [tip, setTip] = useState<{ x: number; y: number; key: string } | null>(null);
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  const cx = 90, cy = 90, r = 72;

  let angle = -Math.PI / 2; // start at 12 o'clock
  const paths = slices.map((sl) => {
    const frac = sl.value / total;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    const d = frac >= 0.9995
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` // full circle edge case
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...sl, d, pct: frac * 100 };
  });

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg viewBox="0 0 180 180" width={140} height={140} role="img" aria-label="Entries by stage">
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill={p.color}
            stroke="var(--paper)"
            strokeWidth={1}
            style={{ cursor: onSelect ? "pointer" : "default" }}
            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, key: p.key })}
            onMouseLeave={() => setTip(null)}
            onClick={() => onSelect?.(p.key)}
          />
        ))}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
        {paths.map((p) => (
          <div
            key={p.key}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: onSelect ? "pointer" : "default" }}
            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, key: p.key })}
            onMouseLeave={() => setTip(null)}
            onClick={() => onSelect?.(p.key)}
          >
            <span style={{ width: 9, height: 9, background: p.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
            <span className="num" style={{ marginLeft: "auto", color: "var(--ink-2)", fontSize: 10.5 }}>{p.value} · {p.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      {tip && (
        <Tooltip x={tip.x} y={tip.y}>
          {paths.find((p) => p.key === tip.key)?.detail}
        </Tooltip>
      )}
    </div>
  );
}
