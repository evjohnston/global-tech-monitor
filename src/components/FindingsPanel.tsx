import type { Finding } from "../lib/findingsEngine.ts";
import type { DrawerTarget } from "../lib/drawerTarget.ts";

// The findings layer (section 6) — real, threshold-gated, traceable
// findings placed after the metric cards and before the first chart on
// every dashboard, so the page's actual news isn't buried under a wall of
// charts a reader has to interpret themselves first.
export function FindingsPanel({
  findings,
  onOpenTarget,
}: {
  findings: Finding[];
  onOpenTarget: (t: DrawerTarget) => void;
}) {
  if (findings.length === 0) return null;
  return (
    <div className="findings-panel">
      {findings.map((f) => (
        <div key={f.id} className="finding-item">
          <div className="finding-text">{f.text}</div>
          <div className="finding-meta">
            {f.period && <span className="finding-period">{f.period}</span>}
            {(f.target || f.scrollToId) && (
              <button
                className="finding-link"
                onClick={() => {
                  if (f.target) onOpenTarget(f.target);
                  else if (f.scrollToId) document.getElementById(f.scrollToId)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                View comparison →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
