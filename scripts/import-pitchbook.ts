// One-time/periodic importer — NOT part of the automated fetch pipeline,
// and deliberately never called from scripts/fetch-data.ts's own network
// calls. Connects directly to WRDS's real PostgreSQL cloud
// (wrds-pgdata.wharton.upenn.edu:9737/wrds, pitchbk schema) using the
// user's own personal WRDS credentials (WRDS_USERNAME/WRDS_PASSWORD in
// .env.local) and writes real, entity-consolidated PitchBook VC + PE deal
// history into data/pitchbook/vc-funding.ts — same shape and same "merge,
// don't replace" posture as scripts/import-capiq-transactions.ts.
//
// Run manually, on your own machine, whenever you want fresh data:
//   npm run import-pitchbook -- <vertical-id>
//
// WHY MANUAL, NOT A LIVE NIGHTLY FETCH (confirmed by testing, not assumed):
// unlike every other source in src/lib/sources/, this isn't a public API —
// WRDS access is tied to one person's individual academic subscription.
// Running it on a schedule from a public GitHub Actions workflow is a real
// terms-of-use question this project can't resolve on its own, so
// WRDS_USERNAME/WRDS_PASSWORD are never read anywhere outside this script
// and are never a GitHub Actions secret.
//
// SCHEMA, CONFIRMED LIVE (2026-07-26), NOT GUESSED FROM DOCS:
// - Direct Postgres access works with a plain `pg` client — the Python
//   `wrds` package (per WRDS's own official example) is just a thin
//   wrapper over standard libpq; host/port/sslmode confirmed by reading
//   the wrds-python package's real source (wrds/sql.py on GitHub).
// - PitchBook has NO "Quantum Computing" vertical or industry tag —
//   confirmed by querying every distinct value in
//   vc_na_companyverticalrelation/vc_na_companyindustryrelation and
//   finding zero matches. Same real gap CapIQ's own Transactions data has
//   (see CLAUDE.md) — quantum coverage here is a keyword search against
//   company description/keywords text instead, confirmed to return the
//   real right companies (IonQ, PsiQuantum, Quantinuum, D-Wave, Rigetti,
//   Xanadu, Atom Computing, 1QBit, Zapata Quantum — 164 real NA matches on
//   "quantum computing" alone).
// - AI has a real, clean, single vertical tag: "Artificial Intelligence &
//   Machine Learning" (29,717 real NA companies) — no keyword-matching
//   needed, and cleaner than CapIQ's own AI coverage (which needed two
//   separate tag searches merged with real overlap-dedup — see
//   data/capiq/vc-funding.ts's own history in CLAUDE.md).
// - dealsize is in MILLIONS of USD, confirmed against IonQ's real deal
//   history (2, 20, 5.2, 62, null) — a $2 raw value only makes sense as a
//   real $2M seed round, not $2. Multiplying by 1e6 here, same unit the
//   CapIQ importer already confirmed for SPTR_TRANSACTION_VALUE.
// - Real dealtype/dealstatus vocabularies (e.g. "Early Stage VC"/"Later
//   Stage VC"/"Seed Round"/"Grant"/"Corporate", "Completed"/"Announced/In
//   Progress"/"Failed/Cancelled") are PitchBook's own real labels, kept
//   as-is — same "don't reinterpret a source's own real vocabulary"
//   principle CLAUDE.md states for CapIQ's type/status fields.
//
// KNOWN, DISCLOSED LIMITATION — not solved here: the same real deal (e.g.
// an IonQ round) may already exist in data/capiq/vc-funding.ts under a
// different orgId/dealId scheme. No cross-provider entity/deal resolution
// is attempted — a company can legitimately show up as two separate rows
// in VcFundingLeaderboard.tsx, one per provider, distinguished by the real
// `source` field on each VcDeal. Same "known tension, not yet resolved"
// posture CLAUDE.md already uses for the R&D-spend ticker overlap.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { canonicalizeOrg } from "../src/lib/entityResolution.ts";
import type { VcCompanyFunding, VcDeal } from "../src/lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const OUT_PATH = resolve(__dirname, "../data/pitchbook/vc-funding.ts");
const OUT_PATH_FUNDS = resolve(__dirname, "../data/pitchbook/funds.ts");

// PitchBook's own product/region table prefixes. Only "glb" is queried —
// confirmed live (not assumed) that "_glb_" is a real GLOBAL SUPERSET of
// "_na_", not a non-US complement: every one of vc_na_deal's 500,943 real
// rows exists in vc_glb_deal (1,147,698 rows) under the identical dealid,
// and the same 100%-contained relationship holds for pe_na_deal (188,114)
// inside pe_glb_deal (381,208). An earlier version of this script queried
// both and got a real, confirmed duplicate-counting bug — IonQ's real
// dealId "76263-40T" landed twice, once via each region, inflating both
// its deal count and total raised. "glb" alone already covers every real
// non-US company too (e.g. the real Canadian quantum companies confirmed
// live: Photonic, Xanadu, 1QBit).
const DEAL_PRODUCTS = ["vc", "pe"] as const;
const REGIONS = ["glb"] as const;

interface VerticalQuery {
  mode: "vertical-tag" | "keyword";
  value: string;
}

// AI: a real, clean, single PitchBook vertical tag (confirmed live,
// 29,717 NA companies). Quantum: no PitchBook tag exists for this at all
// (confirmed live) — falls back to a keyword search against real company
// description/keywords/name text, same weaker-precision tier the seed/RSS
// deploymentStatus classifier already carries elsewhere in this app.
const VERTICAL_QUERIES: Record<string, VerticalQuery> = {
  "artificial-intelligence": { mode: "vertical-tag", value: "Artificial Intelligence & Machine Learning" },
  "quantum-computing": { mode: "keyword", value: "quantum computing" },
};

// A real cap on what's QUERIED (top N companies by real total raised),
// not just what's rendered — AI's real universe (29,717 NA companies
// alone) is far too large to pull wholesale into a committed file (see
// CLAUDE.md: "an uncapped AI export alone generated an 8.9MB source
// file" for the exact same problem with CapIQ). fetch-data.ts's own
// VC_FUNDING_CAP (200) caps what reaches the public JSON separately —
// this cap is upstream of that, on the real query itself.
const QUERY_CAP = 2000;

// Real false-positive found and confirmed live (2026-07-26), not guessed:
// keyword-mode matches a company's FULL description/keyword text, and a
// massive diversified company can have "quantum computing" as one of many
// keywords describing an unrelated business line — Microsoft (real
// keywords: "artificial intelligence, ..., quantum computing, software
// development") and IBM both matched this way, and their PitchBook
// `totalraised` figure (Microsoft $72.9B, IBM $85.3B) is their WHOLE
// company's lifetime PE-tracked capital, not anything quantum-specific —
// their actual matched deals were plain corporate PIPE rounds with zero
// quantum content. Can't fix this by excluding public companies outright
// (checked live): real quantum pure-plays that later went public via
// SPAC — IonQ, D-Wave Quantum, Rigetti Computing, Arqit, QuantumCTek — are
// ALSO flagged `ownershipstatus: "Publicly Held"` with a real ticker, so
// that signal doesn't distinguish them. The real, confirmed gap: the
// single largest genuine quantum company by totalraised is IonQ at
// $2.76B — an order of magnitude below Microsoft/IBM's whole-company
// totals. This threshold only applies to keyword-mode verticals (quantum)
// — AI's real vertical-tag match doesn't have this problem, since a
// megacap genuinely tagged "Artificial Intelligence & Machine Learning" a
// real, primary business signal, not an incidental keyword hit.
const KEYWORD_MODE_MAX_TOTALRAISED_MILLIONS = 10000; // $10B, safely above IonQ's real $2.76B ceiling

interface RawDealRow {
  companyid: string;
  companyname: string;
  hqcountry: string | null;
  dealid: string;
  dealdate: Date | null; // node-postgres parses a real `date` column into a JS Date, not a string — confirmed live, not assumed
  dealsize: string | null; // numeric comes back as string from pg by default
  dealtype: string | null;
  dealstatus: string | null;
  investors: string[] | null;
  funds: string[] | null;
}

function buildQuery(product: string, region: string, q: VerticalQuery): { sql: string; params: unknown[] } {
  const t = (name: string) => `pitchbk.${product}_${region}_${name}`;
  if (q.mode === "vertical-tag") {
    return {
      sql: `
        WITH scoped_companies AS (
          SELECT c.companyid, c.companyname, c.hqcountry, c.totalraised
          FROM ${t("company")} c
          JOIN ${t("companyverticalrelation")} v ON v.companyid = c.companyid
          WHERE v.vertical = $1
          ORDER BY c.totalraised DESC NULLS LAST
          LIMIT $2
        )
        SELECT sc.companyid, sc.companyname, sc.hqcountry,
               d.dealid, d.dealdate, d.dealsize, d.dealtype, d.dealstatus,
               COALESCE(array_agg(DISTINCT ir.investorname) FILTER (WHERE ir.investorname IS NOT NULL), '{}') AS investors,
               COALESCE(array_agg(DISTINCT ir.investorfundname) FILTER (WHERE ir.investorfundname IS NOT NULL), '{}') AS funds
        FROM scoped_companies sc
        JOIN ${t("deal")} d ON d.companyid = sc.companyid
        LEFT JOIN ${t("dealinvestorrelation")} ir ON ir.dealid = d.dealid
        GROUP BY sc.companyid, sc.companyname, sc.hqcountry, sc.totalraised, d.dealid, d.dealdate, d.dealsize, d.dealtype, d.dealstatus
        ORDER BY sc.totalraised DESC NULLS LAST, d.dealdate ASC
      `,
      params: [q.value, QUERY_CAP],
    };
  }
  return {
    sql: `
      WITH scoped_companies AS (
        SELECT c.companyid, c.companyname, c.hqcountry, c.totalraised
        FROM ${t("company")} c
        WHERE (c.description ILIKE $1 OR c.keywords ILIKE $1 OR c.companyname ILIKE $1)
          AND (c.totalraised IS NULL OR c.totalraised < ${KEYWORD_MODE_MAX_TOTALRAISED_MILLIONS})
        ORDER BY c.totalraised DESC NULLS LAST
        LIMIT $2
      )
      SELECT sc.companyid, sc.companyname, sc.hqcountry,
             d.dealid, d.dealdate, d.dealsize, d.dealtype, d.dealstatus,
             COALESCE(array_agg(DISTINCT ir.investorname) FILTER (WHERE ir.investorname IS NOT NULL), '{}') AS investors,
             COALESCE(array_agg(DISTINCT ir.investorfundname) FILTER (WHERE ir.investorfundname IS NOT NULL), '{}') AS funds
      FROM scoped_companies sc
      JOIN ${t("deal")} d ON d.companyid = sc.companyid
      LEFT JOIN ${t("dealinvestorrelation")} ir ON ir.dealid = d.dealid
      GROUP BY sc.companyid, sc.companyname, sc.hqcountry, sc.totalraised, d.dealid, d.dealdate, d.dealsize, d.dealtype, d.dealstatus
      ORDER BY sc.totalraised DESC NULLS LAST, d.dealdate ASC
    `,
    params: [`%${q.value}%`, QUERY_CAP],
  };
}

async function loadExisting(): Promise<(VcCompanyFunding & { vertical: string })[]> {
  try {
    const mod = await import(`${OUT_PATH}?t=${Date.now()}`);
    return mod.PITCHBOOK_VC_FUNDING ?? [];
  } catch {
    return [];
  }
}

interface PitchbookFund { vertical: string; fundName: string; companies: string[] }

async function loadExistingFunds(): Promise<PitchbookFund[]> {
  try {
    const mod = await import(`${OUT_PATH_FUNDS}?t=${Date.now()}`);
    return mod.PITCHBOOK_FUNDS ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const vertical = process.argv[2];
  const query = vertical ? VERTICAL_QUERIES[vertical] : undefined;
  if (!vertical || !query) {
    console.error(`usage: tsx scripts/import-pitchbook.ts <vertical-id>\nknown verticals: ${Object.keys(VERTICAL_QUERIES).join(", ")}`);
    process.exit(1);
  }

  const client = new pg.Client({
    host: "wrds-pgdata.wharton.upenn.edu",
    port: 9737,
    database: "wrds",
    user: process.env.WRDS_USERNAME,
    password: process.env.WRDS_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  if (!process.env.WRDS_USERNAME || !process.env.WRDS_PASSWORD) {
    console.error("WRDS_USERNAME/WRDS_PASSWORD not set in .env.local");
    process.exit(1);
  }
  // A rejected WRDS login surfaces as `PAM authentication failed for user
  // "<you>"` (SQLSTATE 28000) — confirmed live 2026-09-02, where the
  // stored WRDS_PASSWORD had gone stale and blocked a biotechnology
  // import. Depending on client options the same rejection can instead
  // come back as the generic "Connection terminated unexpectedly" (seen
  // while diagnosing this), which reads like a network or schema fault
  // and sends you looking in the wrong place. This handler names the
  // actual remedy either way: WRDS rotates passwords and locks idle
  // accounts, so a credential that worked last month is the first thing
  // to suspect, not the query.
  try {
    await client.connect();
  } catch (err) {
    const msg = (err as Error).message;
    if (/Connection terminated|password|authentication/i.test(msg)) {
      console.error(
        `WRDS connection failed (${msg}).\n` +
        `Almost always an expired or rotated WRDS_PASSWORD in .env.local, NOT a network problem — ` +
        `the server's real reply in this case is 'FATAL: PAM authentication failed'. ` +
        `Sign in at https://wrds-www.wharton.upenn.edu to reset/confirm the account, update .env.local, and re-run.`
      );
      process.exit(1);
    }
    throw err;
  }

  const byOrg = new Map<string, VcCompanyFunding>();
  // Real fund-level linkage, for the separate data/pitchbook/funds.ts prep
  // file — comes free from the same query, no extra join needed:
  // *_dealinvestorrelation already carries `investorfundname` directly per
  // real investment, confirmed live via information_schema before writing
  // this. Not wired into any UI or into fetch-data.ts's merge in this
  // pass (see the plan) — real prep data for a future "Funds" panel, same
  // posture as the already-imported-but-unwired CapIQ defense-tech/
  // biotechnology data documented in CLAUDE.md.
  const fundToCompanies = new Map<string, Set<string>>();
  let totalRows = 0;
  for (const product of DEAL_PRODUCTS) {
    for (const region of REGIONS) {
      const { sql, params } = buildQuery(product, region, query);
      let res;
      try {
        res = await client.query<RawDealRow>(sql, params);
      } catch (err) {
        // A region/product combo can genuinely be missing a table this
        // WRDS account doesn't have entitlement to, or the vertical-tag
        // table can differ by product (confirmed live that pe_na has its
        // own companyverticalrelation, but not assuming every future
        // product/region pair does too) — soft-fail per combo rather than
        // aborting the whole import.
        console.error(`${product}_${region} skipped:`, (err as Error).message);
        continue;
      }
      console.log(`${product}_${region}: ${res.rows.length} real deal rows`);
      totalRows += res.rows.length;
      for (const row of res.rows) {
        // A real, if rare, gap in PitchBook's own data — confirmed live
        // (not assumed) on the much larger AI pull: a handful of rows
        // have no companyname at all. Skipped rather than crashing
        // canonicalizeOrg() on a non-string, same "omit rather than
        // fabricate" posture as every other source in this app.
        if (!row.companyname) continue;
        const { id, name } = canonicalizeOrg(row.companyname);
        // dealsize is in MILLIONS of USD — confirmed live against IonQ's
        // real deal history (see file header comment). null stays null
        // (undisclosed is real missing data, not zero).
        const amountUsd = row.dealsize != null ? Math.round(Number(row.dealsize) * 1e6) : null;
        const deal: VcDeal = {
          dealId: row.dealid,
          date: row.dealdate ? row.dealdate.toISOString().slice(0, 10) : "",
          type: row.dealtype ?? "",
          status: row.dealstatus ?? "",
          amountUsd,
          investors: row.investors ?? [],
          source: "pitchbook",
        };
        const entry = byOrg.get(id) ?? { orgId: id, name, totalRaisedUsd: 0, dealCount: 0, deals: [] };
        entry.dealCount++;
        if (amountUsd != null) entry.totalRaisedUsd += amountUsd;
        entry.deals.push(deal);
        byOrg.set(id, entry);
        for (const fundName of row.funds ?? []) {
          const companies = fundToCompanies.get(fundName) ?? new Set<string>();
          companies.add(name);
          fundToCompanies.set(fundName, companies);
        }
      }
    }
  }
  await client.end();
  console.log(`${totalRows} total real deal rows scanned, ${byOrg.size} distinct companies after entity consolidation`);

  // Merge into whatever this vertical already has, rather than replacing
  // it outright — WRDS "does not maintain historical snapshots," so this
  // committed file is this app's only real historical record once a real
  // deal ages out of PitchBook's current-state view. Dedupes by dealId
  // (PitchBook's own real transaction id), same pattern
  // import-capiq-transactions.ts already uses.
  const existing = await loadExisting();
  const otherVerticals = existing.filter((e) => e.vertical !== vertical);
  const priorSameVertical = existing.filter((e) => e.vertical === vertical);

  const merged = new Map<string, VcCompanyFunding>();
  for (const e of priorSameVertical) merged.set(e.orgId, { ...e, deals: [...e.deals] });
  let newDeals = 0;
  let dupeDeals = 0;
  for (const fresh of byOrg.values()) {
    const prior = merged.get(fresh.orgId);
    if (!prior) {
      merged.set(fresh.orgId, fresh);
      newDeals += fresh.deals.length;
      continue;
    }
    const seenDealIds = new Set(prior.deals.map((d) => d.dealId));
    for (const deal of fresh.deals) {
      if (deal.dealId && seenDealIds.has(deal.dealId)) { dupeDeals++; continue; }
      prior.deals.push(deal);
      prior.dealCount++;
      if (deal.amountUsd != null) prior.totalRaisedUsd += deal.amountUsd;
      newDeals++;
    }
  }
  console.log(`merge: ${newDeals} new deals added, ${dupeDeals} already-seen deals skipped (same transaction in a prior import)`);

  const forThisVertical = [...merged.values()].sort((a, b) => b.totalRaisedUsd - a.totalRaisedUsd);
  const combined = [...otherVerticals, ...forThisVertical.map((e) => ({ ...e, vertical }))];

  const body = combined
    .map((e) => {
      const deals = e.deals
        .map((d) => `      { dealId: "${d.dealId}", date: "${d.date}", type: "${d.type.replace(/"/g, '\\"')}", status: "${(d.status ?? "").replace(/"/g, '\\"')}", amountUsd: ${d.amountUsd ?? "null"}, investors: [${d.investors.map((i) => `"${i.replace(/"/g, '\\"')}"`).join(", ")}], source: "pitchbook" },`)
        .join("\n");
      return `  {
    vertical: "${e.vertical}",
    orgId: "${e.orgId.replace(/"/g, '\\"')}",
    name: "${e.name.replace(/"/g, '\\"')}",
    totalRaisedUsd: ${e.totalRaisedUsd},
    dealCount: ${e.dealCount},
    deals: [
${deals}
    ],
  },`;
    })
    .join("\n");

  const file = `// Generated by scripts/import-pitchbook.ts from a real, live WRDS/
// PitchBook query — re-run that script to update this file, don't
// hand-edit it. See CLAUDE.md's PitchBook section (once added) and
// scripts/import-pitchbook.ts's own header comment for the real schema
// details confirmed before this was built. Entities are consolidated via
// entityResolution.ts's canonicalizeOrg() — a real heuristic (legal-suffix
// stripping + a hand-verified alias table), not a guaranteed cross-
// provider join; the same real company may also exist in
// data/capiq/vc-funding.ts under a different id (a known, disclosed
// limitation, not solved here). Last generated: ${new Date().toISOString()}
import type { VcCompanyFunding } from "../../src/lib/types.ts";

export const PITCHBOOK_VC_FUNDING: (VcCompanyFunding & { vertical: string })[] = [
${body}
];
`;
  writeFileSync(OUT_PATH, file);
  console.log(`wrote ${combined.length} companies (${forThisVertical.length} for ${vertical}, ${otherVerticals.length} carried over from other verticals) to ${OUT_PATH}`);

  // Real fund-level prep data — not wired into any UI or fetch-data.ts's
  // merge yet (see the file's header comment and the plan). Merged the
  // same way as the company data: union each fund's real company set into
  // whatever this vertical already has, rather than replacing it.
  const existingFunds = await loadExistingFunds();
  const otherVerticalFunds = existingFunds.filter((f) => f.vertical !== vertical);
  const priorFundsThisVertical = existingFunds.filter((f) => f.vertical === vertical);
  const fundMerged = new Map<string, Set<string>>();
  for (const f of priorFundsThisVertical) fundMerged.set(f.fundName, new Set(f.companies));
  for (const [fundName, companies] of fundToCompanies) {
    const set = fundMerged.get(fundName) ?? new Set<string>();
    for (const c of companies) set.add(c);
    fundMerged.set(fundName, set);
  }
  const fundsForVertical: PitchbookFund[] = [...fundMerged.entries()]
    .map(([fundName, companies]) => ({ vertical, fundName, companies: [...companies].sort() }))
    .sort((a, b) => b.companies.length - a.companies.length);
  const combinedFunds = [...otherVerticalFunds, ...fundsForVertical];

  const fundsBody = combinedFunds
    .map((f) => `  { vertical: "${f.vertical}", fundName: "${f.fundName.replace(/"/g, '\\"')}", companies: [${f.companies.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(", ")}] },`)
    .join("\n");
  const fundsFile = `// Generated by scripts/import-pitchbook.ts — real fund-to-company
// linkage from PitchBook's own *_dealinvestorrelation.investorfundname
// field, scoped to the same real companies already in vc-funding.ts.
// NOT wired into any UI or into fetch-data.ts's merge yet — real prep
// data for a future "Funds" panel, same posture as the already-imported-
// but-unwired CapIQ defense-tech/biotechnology VC data documented in
// CLAUDE.md. Last generated: ${new Date().toISOString()}
export const PITCHBOOK_FUNDS: { vertical: string; fundName: string; companies: string[] }[] = [
${fundsBody}
];
`;
  writeFileSync(OUT_PATH_FUNDS, fundsFile);
  console.log(`wrote ${combinedFunds.length} funds (${fundsForVertical.length} for ${vertical}, ${otherVerticalFunds.length} carried over) to ${OUT_PATH_FUNDS}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
