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
import { sleep } from "./util.ts";

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

// ── Federal ASSISTANCE awards (grants), a public-funding source ─────────
//
// Same API and the same free, keyless endpoint as the contract path above,
// but a different question and therefore a different stage. Contracts are a
// government BUYING something, which this app files under adoption. Grants
// are a government FUNDING research, which is what STAGES defines the
// investment stage as — "public research funding, where governments are
// placing money."
//
// Built 2026-09-04 for the space vertical, because NSF is measurably the
// wrong instrument there. This repo's own measurement: NSF funds space
// SCIENCE, not space technology, and a "space technology" keyword matches
// 7% of what it returns. Two better-sounding options were tested first and
// both failed outright, recorded here so nobody spends the afternoon again:
//
//   - NASA TechPort was CLAUDE.md's own suggested fix and does not carry
//     funding at all. Checked exhaustively rather than sampled: 0 of 21,028
//     projects have detailedFunding set, and no project object has any
//     dollar field. TechPort is a technology PORTFOLIO catalogue (TRL,
//     taxonomy, organizations), not a funding database. It would still be a
//     genuinely interesting source for a TRL-progression view, which is a
//     different feature.
//   - SBIR.gov's award API returns HTTP 403 Forbidden for every agency,
//     matching their own docs saying the APIs are under maintenance.
//
// What works is filtering federal grants by CFDA PROGRAM NUMBER rather than
// by keyword. A program number is the funder's own classification of what
// the award is for, so it beats guessing at abstract vocabulary — the same
// reason the CapIQ importer prefers --industry over a topic tag. Measured
// live on NASA 43.012 "Space Technology": roughly 34 of the top 40 awards
// are real space technology (ultra-strong composites, deep-space PNT
// instruments, in-space propellant transfer, regolith beneficiation,
// cold-tolerant lunar electronics, CubeSat laser crosslinks), against NSF's
// 7%. The residual noise is visible and namable rather than diffuse —
// astrobiology, planetary-atmosphere remote sensing, one neutrino detector,
// one EPSCoR capacity grant.
//
// Deliberately generic in agency and program number. USASpending carries
// EVERY federal assistance award, so pointing this at NIH for biotechnology
// (which CLAUDE.md has wanted for months) is a config line rather than a new
// module. Don't hardcode NASA in here.
const GRANT_TYPE_CODES = ["02", "03", "04", "05"];

export async function fetchFederalGrants(
  agencyName: string,
  programNumbers: string[],
  sinceDays = 1095,
): Promise<Entry[]> {
  if (programNumbers.length === 0) return [];
  const end = new Date();
  const start = new Date(end.getTime() - sinceDays * 864e5);
  const earliest = new Date("2007-10-01");
  const startDate = (start < earliest ? earliest : start).toISOString().slice(0, 10);

  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "GlobalTechMonitor/0.3 (research dashboard)" },
    body: JSON.stringify({
      filters: {
        agencies: [{ type: "awarding", tier: "toptier", name: agencyName }],
        award_type_codes: GRANT_TYPE_CODES,
        program_numbers: programNumbers,
        time_period: [{ start_date: startDate, end_date: end.toISOString().slice(0, 10) }],
      },
      fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Start Date", "Description", "generated_internal_id"],
      page: 1,
      limit: MAX_LIMIT,
      // Largest first. The result set exceeds one page (hasNext was true on
      // the live NASA test), so this is a real top-N by award size rather
      // than a census — the same honest-sample posture as the OpenAlex
      // window. Sorting by amount means the cap costs the smallest awards,
      // not a random slice.
      sort: "Award Amount",
      order: "desc",
    }),
  });
  if (!res.ok) throw new Error(`USASpending grants HTTP ${res.status}`);
  const json = (await res.json()) as { results?: UsaSpendingResult[] };

  return (json.results ?? [])
    .filter((r) => r["Award ID"] && r["Recipient Name"])
    .map((r): Entry => ({
      // Namespaced away from the contract path's `usaspending-` ids so a
      // grant and a contract sharing an Award ID can't collide.
      id: `usaspending-grant-${r["Award ID"]}`,
      stage: "investment",
      country: "US", // real US federal award data only — same US-weighting caveat NSF carries
      provenance: "live",
      source: "grant", // feeds fundingByCountry/periodFunding, which are grant-only by design
      title: r.Description || `Federal research grant to ${r["Recipient Name"]}`,
      org: r["Recipient Name"] ?? "",
      date: r["Start Date"] ?? "",
      url: r.generated_internal_id
        ? `https://www.usaspending.gov/award/${r.generated_internal_id}`
        : "https://www.usaspending.gov",
      amountUsd: r["Award Amount"],
      venue: r["Awarding Agency"],
      countryEvidence: "US federal grant recipient (USASpending.gov)",
    }));
}
