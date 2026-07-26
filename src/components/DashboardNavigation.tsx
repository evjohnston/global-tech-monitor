import type { Dashboard } from "../lib/urlState.ts";

const DASHBOARDS: { key: Dashboard; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "research", label: "Research" },
  { key: "scaling", label: "Scaling" },
  { key: "adoption", label: "Adoption" },
  { key: "money", label: "Money" },
];

// The five persistent dashboard tabs — one consistent label set used
// everywhere (never "Track Research" in one place and "Research" in
// another). "Track" is a single eyebrow above the row, not repeated
// inside each button.
export function DashboardNavigation({ active, onNavigate }: { active: Dashboard; onNavigate: (d: Dashboard) => void }) {
  return (
    <>
      <div className="dashboard-nav-heading">Track</div>
      <nav className="dashboard-nav" aria-label="Dashboards">
        {DASHBOARDS.map((d) => (
          <button
            key={d.key}
            className="dashboard-nav-btn"
            aria-pressed={active === d.key}
            aria-current={active === d.key ? "page" : undefined}
            onClick={() => onNavigate(d.key)}
          >
            {d.label}
          </button>
        ))}
      </nav>
    </>
  );
}
