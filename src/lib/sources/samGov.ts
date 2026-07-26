// SAM.gov Opportunities — real, currently-posted (or recently posted) US
// federal contract solicitations. Confirmed by hand (2026-07-26) against
// the live API using a real key before writing this: `GET
// https://api.sam.gov/opportunities/v2/search`, auth via an `api_key` query
// param, `postedFrom`/`postedTo` (MM/DD/YYYY) mandatory, `title` does a
// keyword match. A real query for `title=quantum` returned real, current
// DARPA/NASA solicitations (e.g. "Quantum Benchmarking Initiative (QBI)
// 2026 Announcement", solicitation DARPA-PA-26-02, posted 2025-11-14).
//
// Complements usaSpending.ts rather than duplicating it: USASpending only
// has already-EXECUTED contracts; a SAM.gov opportunity is real, but
// earlier in the lifecycle — a posted solicitation with no award yet is a
// genuine "announced" signal, and `award` becoming non-null is the real
// transition to "procurement." The two live opportunities checked while
// building this were both still open (`award: null`) — the real shape of a
// populated `award` object was NOT confirmed live in this session. Reading
// it defensively (multiple possible key names, never assuming one) and
// logging the raw object once on a real hit, rather than guessing a schema
// and silently dropping/misreading it.
//
// `description` on every real result is a URL to a second endpoint, not
// inline text — not fetched here; title + metadata is enough signal for
// this app's stage/status classification without an extra request per
// notice.
//
// Real, load-bearing constraint discovered by hand while building this
// (2026-07-26), not documented anywhere obvious in SAM's own API pages: a
// non-federal API key (this app's `SAM_KEY` — visible in the response's own
// `x-api-roles: SI-NONFED` header) has a low DAILY quota, not just a
// per-request rate limit. A 429 mid-testing returned the real body
// `{"code":"900804","message":"Message throttled out","description":"You
// have exceeded your quota. You can access API after <next UTC
// midnight>"}` — confirming the quota resets once/day, not on a rolling
// window. This app's nightly build (scripts/fetch-data.ts) currently runs
// every 3 hours (see CLAUDE.md) across 2 verticals; at even 1-3 requests
// per vertical per run, most runs in a given day WILL exhaust this key's
// quota and get a 429 for the rest of that UTC day. That's expected, not a
// bug: fetchSamOpportunities throws on it like any other HTTP error,
// caught by fetch-data.ts's existing soft-fail try/catch, so a quota-
// exhausted run just logs a skip and leaves whatever SAM-derived entries
// already accumulated from an earlier successful run in place (entries
// accumulate by id — see fetch-data.ts's byId merge) rather than crashing
// the build or blanking prior data. Solicitation postings don't change
// meaningfully every 3 hours anyway, so a real cadence of roughly once/day
// (whichever run in the rotation still has quota left) is an honest
// fit, not a degraded one.
import type { Entry } from "../types.ts";

const BASE = "https://api.sam.gov/opportunities/v2/search";

interface SamAward {
  // Real key name not yet confirmed live (see the file comment) — every
  // plausible shape is read, never assumed.
  awardee?: { name?: string } | string;
  awardeeName?: string;
  amount?: number | string;
}

interface SamOpportunity {
  noticeId?: string;
  title?: string;
  fullParentPathName?: string;
  postedDate?: string;
  uiLink?: string;
  award?: SamAward | null;
}

function mmddyyyy(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function awardeeNameOf(award: SamAward): string {
  if (typeof award.awardee === "string") return award.awardee;
  if (award.awardee?.name) return award.awardee.name;
  if (award.awardeeName) return award.awardeeName;
  return "";
}

let loggedAwardShapeOnce = false;

// SAM's real, confirmed limit (found by testing, not documented anywhere
// obvious): a `postedFrom`/`postedTo` request rejects with 400
// `"Date range must be null year(s) apart"` past 364 days — 365 already
// fails. A `sinceDays` wider than that (this app's other sources default
// to 730d/2y for a real multi-year lookback) is split into consecutive
// ≤364-day windows and queried one at a time, rather than silently
// truncating to only the most recent year.
const MAX_WINDOW_DAYS = 364;
const WINDOW_GAP_MS = 1200;

async function fetchWindow(apiKey: string, keyword: string, start: Date, end: Date): Promise<SamOpportunity[]> {
  const url = new URL(BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("postedFrom", mmddyyyy(start));
  url.searchParams.set("postedTo", mmddyyyy(end));
  url.searchParams.set("title", keyword);
  url.searchParams.set("limit", "100");
  const res = await fetch(url.toString(), { headers: { "User-Agent": "GlobalTechMonitor/0.3 (research dashboard)" } });
  if (!res.ok) throw new Error(`SAM.gov HTTP ${res.status}`);
  const json = (await res.json()) as { opportunitiesData?: SamOpportunity[] };
  return json.opportunitiesData ?? [];
}

// Defaults to exactly one MAX_WINDOW_DAYS window (not usaSpending.ts's 2-
// year/730-day lookback) — given the real daily-quota constraint above,
// spending 2 requests per vertical for a second, older year of largely-
// expired solicitations isn't worth halving the day's already-tight quota.
export async function fetchSamOpportunities(apiKey: string, keyword: string, sinceDays = MAX_WINDOW_DAYS): Promise<Entry[]> {
  if (!apiKey) throw new Error("SAM_KEY not set");
  const end = new Date();
  const start = new Date(end.getTime() - sinceDays * 864e5);
  const windows: { from: Date; to: Date }[] = [];
  let windowEnd = end;
  while (windowEnd > start) {
    const windowStart = new Date(Math.max(start.getTime(), windowEnd.getTime() - MAX_WINDOW_DAYS * 864e5));
    windows.push({ from: windowStart, to: windowEnd });
    windowEnd = new Date(windowStart.getTime() - 864e5); // next window ends the day before this one starts, no overlap
  }
  const opportunities: SamOpportunity[] = [];
  for (let i = 0; i < windows.length; i++) {
    // 2 back-to-back requests with no gap tripped a real 429 in a live
    // test — SAM.gov's per-key rate limit is stricter than USASpending's.
    if (i > 0) await new Promise((r) => setTimeout(r, WINDOW_GAP_MS));
    opportunities.push(...(await fetchWindow(apiKey, keyword, windows[i].from, windows[i].to)));
  }
  const byId = new Map<string, SamOpportunity>();
  for (const o of opportunities) if (o.noticeId) byId.set(o.noticeId, o);
  return [...byId.values()]
    .filter((o) => o.noticeId && o.title)
    .map((o): Entry => {
      const awarded = o.award != null;
      if (awarded && !loggedAwardShapeOnce) {
        // One-time real-shape dump so a future run can confirm/correct the
        // field-name guesses in awardeeNameOf() above against a real hit —
        // never silently trust a schema that wasn't actually seen.
        console.log("sam-gov: real award object shape (first hit):", JSON.stringify(o.award));
        loggedAwardShapeOnce = true;
      }
      const awardeeName = awarded ? awardeeNameOf(o.award!) : "";
      return {
        id: `sam-${o.noticeId}`,
        stage: "adoption",
        country: "US", // SAM.gov opportunities are real US federal solicitations only
        provenance: "live",
        source: "deployment",
        deploymentStatus: awarded ? "procurement" : "announced",
        title: o.title ?? "",
        org: awardeeName,
        date: (o.postedDate ?? "").slice(0, 10),
        url: o.uiLink || "https://sam.gov",
        venue: o.fullParentPathName,
        countryEvidence: "US federal solicitation (SAM.gov)",
      };
    });
}
