import { type ReactNode, useState } from "react";

export interface PanelTab {
  key: string;
  label: string;
  render: () => ReactNode;
}

// One `.panel` box showing exactly one of several real views at a time,
// switched via buttons — the "similar charts consolidated into the same
// block with buttons" pattern. Each tab owns only its inner content (no
// wrapping .panel/h3 of its own); this component supplies that chrome once
// for the whole group, which is what actually collapses N stacked panels
// into one. Reuses the existing .chip button styling (App.tsx's country
// filter, StageColumn's .stage-chip) rather than inventing a new control.
export function PanelTabs({ title, drop, tabs, newBadge }: { title: string; drop?: string; tabs: PanelTab[]; newBadge?: boolean }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div className="panel">
      <h3>
        <span>{title} {newBadge && <span className="new-badge">New</span>}</span>
        {drop && <span className="drop">{drop}</span>}
      </h3>
      <div className="tab-bar">
        {tabs.map((t) => (
          <button key={t.key} className="chip" aria-pressed={t.key === current?.key} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {current?.render()}
    </div>
  );
}
