import type { Actor, Entry, Stage } from "./types.ts";
import { ACTORS } from "./types.ts";

// Count entries by actor within a stage (or all stages).
export function countByActor(entries: Entry[], stage?: Stage): Record<Actor, number> {
  const out: Record<Actor, number> = { us: 0, cn: 0, eu: 0, other: 0 };
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    out[e.actor]++;
  }
  return out;
}

// Citation-weighted share by actor — the ASPI "high-impact" idea. Falls back
// to raw counts when citation data is absent (arXiv/patent entries).
export function weightByActor(entries: Entry[], stage?: Stage): Record<Actor, number> {
  const out: Record<Actor, number> = { us: 0, cn: 0, eu: 0, other: 0 };
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    out[e.actor] += (e.citations ?? 0) + 1; // +1 so uncited work still counts
  }
  return out;
}

// Sum funding amounts by actor (investment stage).
export function fundingByActor(entries: Entry[]): Record<Actor, number> {
  const out: Record<Actor, number> = { us: 0, cn: 0, eu: 0, other: 0 };
  for (const e of entries) {
    if (e.stage !== "investment") continue;
    out[e.actor] += e.amountUsd ?? 0;
  }
  return out;
}

export interface OrgRow {
  org: string;
  actor: Actor;
  count: number;
}

// Institution leaderboard — who is publishing most, across a stage.
export function orgLeaderboard(entries: Entry[], stage?: Stage, limit = 8): OrgRow[] {
  const map = new Map<string, OrgRow>();
  for (const e of entries) {
    if (stage && e.stage !== stage) continue;
    if (!e.org) continue;
    const key = e.org;
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, { org: e.org, actor: e.actor, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export const ACTOR_LABEL: Record<Actor, string> = Object.fromEntries(
  ACTORS.map((a) => [a.id, a.label])
) as Record<Actor, string>;
