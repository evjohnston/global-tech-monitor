import type { DashboardSummaryCard } from "../lib/dashboardSummaryCards.ts";
import type { Dashboard } from "../lib/urlState.ts";

// One of the Overview's four dashboard cards — current leader, share,
// runner-up, gap, recent change, and a real generated interpretation, all
// from one shared data shape so the four cards can't drift into different
// framings ("fastest riser" vs "largest lead") without saying which
// dashboard/measure each refers to.
export function LeaderCard({ card, onOpen }: { card: DashboardSummaryCard; onOpen: (dashboard: Dashboard, country: string | null) => void }) {
  return (
    <div className="leader-card">
      <div className="leader-card-label">{card.label}</div>
      <div className="leader-card-leader">{card.countryLabel} leads</div>
      <div className="leader-card-share num">{card.leaderSharePct.toFixed(0)}%</div>
      <div className="leader-card-def">{card.definition}</div>
      {card.runnerUpLabel && card.gapPct != null && (
        <div className="leader-card-runnerup">
          {card.runnerUpLabel}: {card.runnerUpSharePct?.toFixed(0)}% · lead: {card.gapPct.toFixed(0)} pts
        </div>
      )}
      {card.changeLabel && <div className="leader-card-change">{card.changeLabel}</div>}
      <div className="leader-card-interpretation">{card.interpretation}</div>
      <button className="leader-card-open" onClick={() => onOpen(card.dashboard, card.country)}>
        Open {card.label} dashboard →
      </button>
    </div>
  );
}
