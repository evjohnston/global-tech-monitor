// USASpending.gov Award Search — real, already-executed US federal
// contracts. Confirmed by hand (2026-07-26) against the live API before
// writing this: `POST /api/v2/search/spending_by_award/` needs no API key
// ("Endpoints do not currently require any authorization" per the docs,
// confirmed by a working keyless request). Combining `recipient_search_text`
// (a real company name) with `keywords` (the vertical's own topical term)
// is what makes this precise — recipient_search_text alone on a large
// diversified company (e.g. IBM) returns thousands of unrelated federal
// contracts (cafeteria services, IT support); adding the topical keyword
// narrowed a live test to exactly the real, on-topic results (a $2.09M
// DARPA "QUANTUM BENCHMARKING PROGRAM" contract, a $1.25M AFRL "QUANTUM
// COMPUTING ALGORITHMS..." contract).
//
// This deliberately only requests CONTRACT-shaped award type codes (real
// procurement of goods/services), not grant codes — NSF already covers
// Investment-stage research grants (nsf.ts); this stays scoped to
// Adoption-stage government procurement, matching the deploymentStatus
// taxonomy's "procurement" bucket with real, structurally-confirmed
// evidence (a returned result IS a signed award) rather than a keyword
// guess.
//
// Known, disclosed limitation: a hand-curated data/<vertical>/seed.ts entry
// (e.g. "IonQ signs a $54.5M contract with AFRL") may describe the SAME
// real-world contract as an award pulled here independently — they get
// different ids and show up as two separate entries. No cross-referencing
// between prose seed entries and structured award records is attempted;
// flagging this rather than silently pretending it's solved.
import type { Entry } from "../types.ts";

const BASE = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const MAX_LIMIT = 100; // confirmed live: {"detail":"Field 'limit' value '101' is above max '100'"}

// Real contract-type codes only (BPA call, purchase order, delivery order,
// definitive contract). DARPA-style multi-stage program awards (e.g.
// "Stage A"/"Stage B" selections in this app's own seed data) are commonly
// structured as IDVs instead — tried adding those codes here too, but a
// live test came back with a real, confirmed API rule: "award_type_codes
// must only contain types from one group" (contracts vs. idvs vs. grants
// are mutually exclusive in a single request). Deliberately deferred
// rather than doubling every company's request count with a second grouped
// query — contracts alone already return real, on-topic results (confirmed
// live: a $2.09M DARPA "QUANTUM BENCHMARKING PROGRAM" contract, a $1.25M
// AFRL "QUANTUM COMPUTING ALGORITHMS..." contract, both for IBM). Revisit
// with a second `award_type_codes: ["IDV_A","IDV_B_A","IDV_B_B","IDV_B_C","IDV_C","IDV_D","IDV_E"]`
// request per company if IDV coverage turns out to matter in practice.
const AWARD_TYPE_CODES = ["A", "B", "C", "D"];

interface UsaSpendingResult {
  "Award ID"?: string;
  "Recipient Name"?: string;
  "Award Amount"?: number;
  "Awarding Agency"?: string;
  "Start Date"?: string;
  Description?: string;
  generated_internal_id?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GAP_MS = 150;

async function fetchOneCompany(companyName: string, keyword: string, sinceDays: number): Promise<Entry[]> {
  const end = new Date();
  const start = new Date(end.getTime() - sinceDays * 864e5);
  // USASpending's own real floor for this endpoint (returned in a live
  // "messages" field, not guessed): "time period start and end dates are
  // currently limited to an earliest date of 2007-10-01."
  const earliest = new Date("2007-10-01");
  const startDate = (start < earliest ? earliest : start).toISOString().slice(0, 10);
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "GlobalTechMonitor/0.3 (research dashboard)" },
    body: JSON.stringify({
      filters: {
        recipient_search_text: [companyName],
        keywords: [keyword],
        award_type_codes: AWARD_TYPE_CODES,
        time_period: [{ start_date: startDate, end_date: end.toISOString().slice(0, 10) }],
      },
      fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Start Date", "Description", "generated_internal_id"],
      page: 1,
      limit: MAX_LIMIT,
      sort: "Award Amount",
      order: "desc",
    }),
  });
  if (!res.ok) throw new Error(`USASpending HTTP ${res.status}`);
  const json = (await res.json()) as { results?: UsaSpendingResult[] };
  const results = json.results ?? [];
  return results
    .filter((r) => r["Award ID"] && r["Recipient Name"])
    .map((r): Entry => ({
      id: `usaspending-${r["Award ID"]}`,
      stage: "adoption",
      country: "US", // USASpending is real US federal award data only — same US-only caveat NSF already carries
      provenance: "live",
      source: "deployment",
      deploymentStatus: "procurement", // a returned result IS a signed award, not a guess
      title: r.Description || `Federal contract with ${r["Recipient Name"]}`,
      org: r["Recipient Name"] ?? "",
      date: r["Start Date"] ?? "",
      url: r.generated_internal_id
        ? `https://www.usaspending.gov/award/${r.generated_internal_id}`
        : "https://www.usaspending.gov",
      amountUsd: r["Award Amount"],
      venue: r["Awarding Agency"],
      countryEvidence: "US federal award recipient (USASpending.gov)",
    }));
}

// One request per real company name, with a short gap between calls — a
// live 5-call rapid-sequential test showed no rate-limit signal, but that's
// not the same as a full 26-47-company vertical back-to-back; watch the
// real nightly build log for HTTP errors before assuming this gap is
// enough, same "confirmed by hand" posture as every other source here.
export async function fetchUsaSpendingAwards(companyNames: string[], keyword: string, sinceDays = 730): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let i = 0; i < companyNames.length; i++) {
    if (i > 0) await sleep(GAP_MS);
    try {
      out.push(...(await fetchOneCompany(companyNames[i], keyword, sinceDays)));
    } catch (err) {
      console.error(`usaspending: ${companyNames[i]} skipped:`, (err as Error).message);
    }
  }
  const byId = new Map<string, Entry>();
  for (const e of out) byId.set(e.id, e);
  return [...byId.values()];
}
