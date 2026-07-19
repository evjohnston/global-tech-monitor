import { useState } from "react";
import type { Actor } from "../lib/types.ts";
import { ACTOR_LABEL } from "../lib/aggregate.ts";
import { Tooltip } from "./Tooltip.tsx";

const ACTOR_VAR: Record<Actor, string> = {
  us: "var(--us)", cn: "var(--cn)", eu: "var(--eu)", other: "var(--other)",
};
// Illustrative fixed positions per actor bucket — this is not a geocoded
// map, just a stable diagram so relative volume reads at a glance.
const POS: Record<Actor, { cx: number; cy: number }> = {
  us: { cx: 65, cy: 55 }, cn: { cx: 230, cy: 62 }, eu: { cx: 150, cy: 42 }, other: { cx: 118, cy: 90 },
};
const ORDER: Actor[] = ["us", "cn", "eu", "other"];

export function MiniMap({
  counts,
  onSelect,
  active,
}: {
  counts: Record<Actor, number>;
  onSelect?: (a: Actor) => void;
  active?: Actor | "all";
}) {
  const [tip, setTip] = useState<{ x: number; y: number; a: Actor } | null>(null);
  const max = Math.max(1, ...ORDER.map((a) => counts[a]));
  return (
    <div className="mapbox">
      <svg viewBox="0 0 300 120" width="100%" height="100%">
        {ORDER.map((a) => {
          const r = 4 + (counts[a] / max) * 8;
          return (
            <circle
              key={a}
              cx={POS[a].cx}
              cy={POS[a].cy}
              r={r}
              fill={ACTOR_VAR[a]}
              opacity={active && active !== "all" && active !== a ? 0.25 : 1}
              style={{ cursor: onSelect ? "pointer" : undefined }}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, a })}
              onMouseLeave={() => setTip(null)}
              onClick={() => onSelect?.(a)}
            />
          );
        })}
      </svg>
      {tip && (
        <Tooltip x={tip.x} y={tip.y}>
          {ACTOR_LABEL[tip.a]} · {counts[tip.a]} works{onSelect ? " · click to filter" : ""}
        </Tooltip>
      )}
    </div>
  );
}
