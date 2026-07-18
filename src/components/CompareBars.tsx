import type { Actor } from "../lib/types.ts";
import { ACTOR_LABEL } from "../lib/aggregate.ts";

const ACTOR_VAR: Record<Actor, string> = {
  us: "var(--us)", cn: "var(--cn)", eu: "var(--eu)", other: "var(--other)",
};
const ORDER: Actor[] = ["us", "cn", "eu", "other"];

export function CompareBars({
  counts,
  format = (n) => String(n),
}: {
  counts: Record<Actor, number>;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...ORDER.map((a) => counts[a]));
  const sorted = [...ORDER].sort((a, b) => counts[b] - counts[a]);
  return (
    <div className="cmp">
      {sorted.map((a) => (
        <div className="cmp-row" key={a}>
          <div className="cmp-name">{ACTOR_LABEL[a]}</div>
          <div className="cmp-track">
            <div
              className="cmp-fill"
              style={{ width: `${(counts[a] / max) * 100}%`, background: ACTOR_VAR[a] }}
            />
          </div>
          <div className="cmp-val">{format(counts[a])}</div>
        </div>
      ))}
    </div>
  );
}
