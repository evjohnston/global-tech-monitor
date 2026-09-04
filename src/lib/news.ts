import type { Entry, Stage } from "./types.ts";
import type { Dashboard } from "./urlState.ts";

// A "news story" in this app is a real, provenance:"auto" entry — RSS
// trade-press (scaling/adoption) or Google News (investment). Never a raw
// paper/patent/grant/hand-verified milestone — those are real records, not
// news reports, and mixing them into a "breaking news" strip understated
// which items were actually current reporting vs. a database row that
// happened to have a recent date.
export function isNewsEntry(e: Entry): boolean {
  return e.provenance === "auto";
}

export type NewsCategory = "Policy" | "Research" | "Scaling" | "Adoption" | "Funding" | "Company" | "Security" | "International" | "News";

const SECURITY_RE = /\b(breach|vulnerabilit|cyberattack|hack(ed|ing)?|exploit|ransomware|espionage)\b/i;
const INTL_RE = /\b(export control|sanction|tariff|treaty|alliance|bilateral|multilateral|NATO|G7|G20|diplomatic)\b/i;
const POLICY_RE = /\b(regulat|legislat|congress|senate|parliament|executive order|white house|policy|ban on|restrict)\b/i;
const COMPANY_RE = /\b(acqui(re|sition)|merger|partnership|IPO|spin-?off|lay-?off|earnings|CEO|executive)\b/i;
const STAGE_CATEGORY: Record<Stage, NewsCategory> = {
  innovation: "Research", scaling: "Scaling", adoption: "Adoption", investment: "Funding",
};

// A real, disclosed, keyword-based classification — never presented as
// hand-coded. Checked in a fixed priority order (security/international/
// policy read across every stage; company-shaped stories reclassify an
// investment-stage entry that's really about a deal, not a raise) before
// falling back to the entry's own stage.
export function newsCategory(e: Entry): NewsCategory {
  const text = `${e.title} ${e.abstract ?? ""}`;
  if (SECURITY_RE.test(text)) return "Security";
  if (INTL_RE.test(text)) return "International";
  if (POLICY_RE.test(text)) return "Policy";
  if (e.stage === "investment" && COMPANY_RE.test(text)) return "Company";
  return STAGE_CATEGORY[e.stage] ?? "News";
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface NewsGroup {
  primary: Entry;
  alsoReportedBy: Entry[];
}

// Merges repeated coverage of the same real event — same canonical URL, or
// a near-identical normalized title within a short window — into one
// primary story (most recent) plus the rest as "also reported by." Never
// silently drops the duplicates; they stay reachable in the drawer.
export function dedupeNews(entries: Entry[]): NewsGroup[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  const groups: NewsGroup[] = [];
  const seenUrls = new Set<string>();
  const byNormTitle = new Map<string, NewsGroup>();

  for (const e of sorted) {
    if (seenUrls.has(e.url)) {
      const existing = groups.find((g) => g.primary.url === e.url || g.alsoReportedBy.some((a) => a.url === e.url));
      existing?.alsoReportedBy.push(e);
      continue;
    }
    const norm = normalizeTitle(e.title);
    const existingByTitle = byNormTitle.get(norm);
    if (existingByTitle) {
      existingByTitle.alsoReportedBy.push(e);
    } else {
      const group: NewsGroup = { primary: e, alsoReportedBy: [] };
      groups.push(group);
      byNormTitle.set(norm, group);
    }
    seenUrls.add(e.url);
  }
  return groups;
}

const TRACK_STAGE: Record<Exclude<Dashboard, "overview" | "money">, Stage> = {
  research: "innovation", scaling: "scaling", adoption: "adoption",
};

// Per-track relevance ranking — recency-weighted, boosted when the story's
// own stage matches the active dashboard, and boosted again when it names
// the active country filter. Never a black-box "importance score" — every
// input is a real, inspectable field (date, stage, country).
export function rankNewsForTrack(groups: NewsGroup[], opts: { dashboard: Dashboard; country?: string | null; now?: Date }): NewsGroup[] {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const activeStage = opts.dashboard === "overview" || opts.dashboard === "money" ? null : TRACK_STAGE[opts.dashboard];

  function score(g: NewsGroup): number {
    const e = g.primary;
    // An unparseable date must not poison the score. Without the isFinite
    // guard, ageDays is NaN, so the whole score is NaN, and a NaN comparator
    // result makes Array.sort treat the pair as equal — one bad date
    // scrambles the entire ranking rather than misplacing one story.
    // Currently no live entry is dateless, but three ingestion paths can
    // emit `date: ""` (both USASpending fetchers default it, and the CapIQ
    // importer stores it for an empty cell), so this is one line against a
    // real failure mode. A dateless entry scores as maximally old, which is
    // the honest default for "we don't know when this happened".
    const parsed = new Date(e.date).getTime();
    const ageDays = Number.isFinite(parsed) ? Math.max(0, (nowMs - parsed) / 864e5) : Infinity;
    let s = Math.exp(-ageDays / 4); // ~4-day half-life-ish decay
    if (activeStage && e.stage === activeStage) s += 1.5;
    if (opts.dashboard === "money" && e.stage === "investment") s += 1.5;
    if (opts.country && e.country === opts.country) s += 2;
    s += Math.min(g.alsoReportedBy.length, 3) * 0.1; // widely-reported stories nudge up, capped
    return s;
  }

  const scored = groups.map((g) => ({ g, s: score(g) }));
  scored.sort((a, b) => b.s - a.s);

  // Avoid several stories about the same org back to back — cap at 2
  // consecutive-ranked stories per org, pushing the rest down rather than
  // dropping them.
  const seenOrgCount = new Map<string, number>();
  const boosted: typeof scored = [];
  const deferred: typeof scored = [];
  for (const item of scored) {
    const key = item.g.primary.org || item.g.primary.publisher || "";
    const count = seenOrgCount.get(key) ?? 0;
    if (key && count >= 2) {
      deferred.push(item);
    } else {
      boosted.push(item);
      if (key) seenOrgCount.set(key, count + 1);
    }
  }
  return [...boosted, ...deferred].map((x) => x.g);
}

export function newsFreshnessLabel(dateIso: string, now = new Date()): string {
  const then = new Date(dateIso).getTime();
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(dateIso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
