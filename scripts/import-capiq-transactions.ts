// One-time/periodic importer — NOT part of the automated fetch pipeline.
// Parses a manually-exported S&P Capital IQ Pro Transactions screen
// (SPTR_TARGET_NAME/SPTR_ANN_DATE/SPTR_TRANSACTION_TYPE/SPTR_STATUS/
// SPTR_TRANSACTION_VALUE fields) and writes real, entity-consolidated
// per-company VC funding history into data/capiq/vc-funding.ts.
//
// Same manual/no-key reasoning as import-capiq-rd-export.ts (Capital IQ's
// Excel plugin is Windows-only; there's no API entitlement confirmed for
// this account) and the same "never commit the raw .xlsx" rule (S&P's
// data licensing doesn't permit redistributing raw exports — see
// .gitignore's SPGlobal_Export_* pattern).
//
// Confirmed by hand against a real export (2026-07-25): SPTR_TRANSACTION_
// VALUE is in MILLIONS of USD, not thousands like the R&D export — Series
// H Anthropic (65000) and OpenAI's round (122000) match the real $65B/
// $122B figures only when read as millions. Note SPTR_ANN_DATE isn't
// always the public press-release date, though — Anthropic's Series H
// shows 2026-04-20 here vs. 2026-05 confirmed directly against anthropic.
// com/news/series-h for the hand-curated seed entry (data/ai/seed.ts).
// Both are real dates, likely a CapIQ internal/filing reference date vs.
// the public announcement date — don't treat SPTR_ANN_DATE as more
// authoritative than a verified primary-source date if the two conflict.
// The export mixes every transaction type (M&A, buybacks, debt issuance,
// follow-on offerings) alongside real VC rounds — VC_TYPE_PREFIXES below
// is the filter that isolates genuine financing rounds.
//
// Entity consolidation, updated 2026-07-25: a re-export added a real
// `SPTR_TARGET_ID` field (a stable numeric CapIQ entity id), confirmed by
// hand to correctly merge OpenAI's three legal-entity-name rows onto one
// id — this script now groups by that id when present, falling back to
// entityResolution.ts's canonicalizeOrg() (name-heuristic) only when it
// isn't. Display name still runs through canonicalizeOrg() either way,
// purely for legal-suffix cleanup, not for grouping. Not every export
// includes every optional column — this quarter's quantum export has
// SPTR_TARGET_ID but no SPTR_ANN_DATE at all (confirmed by hand); missing
// dates are stored as "" rather than crashing the import, since the
// company-level totals are still real without them, just not time-
// bucketable for that vertical until a date-inclusive export exists.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCapiqSheet, type XlsxRow } from "./lib/capiqXlsx.ts";
import { canonicalizeOrg } from "../src/lib/entityResolution.ts";
import type { VcCompanyFunding, VcDeal } from "../src/lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../data/capiq/vc-funding.ts");

// Real transaction-type prefixes confirmed against the export's own
// SPTR_TRANSACTION_TYPE values (2026-07-25) — CapIQ's "Round of Financing"
// taxonomy. Deliberately excludes M&A - *, Buyback, DCM - * (debt), ECM - *
// (public follow-ons), and Shelf - * (shelf registrations) — real
// transactions, just not venture/growth financing rounds.
const VC_TYPE_PREFIXES = ["ROF - Venture", "ROF - Early Stage", "ROF - Mature"];

// Every string this script writes into a .ts source file goes through
// here. The original inline `.replace(/"/g, '\\"')` handled quotes and
// nothing else, which was fine until a real export row carried a literal
// newline inside an investor cell ("Adviser Role: \n...") and the
// generated file came out with an unterminated string literal — a build
// break, found 2026-09-02 while re-importing biotechnology. Backslashes
// have to be escaped before quotes, or the escape character added for a
// quote gets escaped in turn.
function tsLit(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim();
}

// A blank or zero date cell reads as serial 0, which converts to Excel's
// own epoch and lands in the data as a real-looking "1899-12-30" — 99 of
// them, found 2026-09-02 in the biotech import. That's a missing date, not
// a 19th-century financing round, so it returns null and gets stored as ""
// like any other absent date. Guarding on `> 0` rather than a specific
// year keeps it about the actual failure (an empty cell) rather than
// second-guessing genuinely old real dates — this export does carry real
// deals back to 1980.
function excelDateToIso(serial: string): string | null {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = (n - 25569) * 86400 * 1000; // Excel epoch (1899-12-30) -> Unix epoch
  return new Date(ms).toISOString().slice(0, 10);
}

async function loadExisting(): Promise<VcCompanyFunding[]> {
  try {
    const mod = await import(`${OUT_PATH}?t=${Date.now()}`);
    return mod.CAPIQ_VC_FUNDING ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const inputPath = process.argv[2];
  const vertical = process.argv[3];
  // Optional: require the topic-tags column to contain this substring.
  // Needed because CapIQ has no dedicated "Quantum Computing" topic tag —
  // confirmed by hand (2026-07-25): "Encryption" and "Post-Quantum
  // Cryptography" are the only quantum-adjacent tags that exist, and
  // "Encryption" alone is broad enough to sweep in mainstream cybersecurity
  // companies (Netskope, Lookout, Crypto.com) with zero quantum relevance.
  // Passing "Post-Quantum Cryptography" here keeps the genuinely
  // quantum-adjacent subset and drops the rest.
  const requireTag = process.argv[4]?.startsWith("--") ? undefined : process.argv[4];
  const flags = process.argv.slice(3).filter((a) => a.startsWith("--"));
  // Some exports have no Topic Tags column at all but DO carry
  // SPTR_IQ_TARGET_PRIMARY_INDUSTRY, CapIQ's own GICS industry for the
  // target — a stronger scoping signal than a topic tag when it's
  // available, because it's a classification of the company rather than a
  // keyword hit on it. Added 2026-09-02 for exactly the case biotechnology
  // hit: the tag-scoped biotech import produced a "who's getting the
  // money" table topped by surgical-robot and cardiac-device companies
  // (Verily Health, CMR Surgical, Impulse Dynamics, Kardium), because the
  // only bio-ish CapIQ tag available was "Biomedical Engineering" — which
  // is medical devices, not biotechnology. The richer raw export has no
  // tags but does have industries, of which 3,447 of 5,024 VC rows are
  // GICS "Biotechnology". Comma-separated, matched exactly against the
  // industry value.
  const requireIndustry = flags.find((f) => f.startsWith("--industry="))?.slice("--industry=".length);
  const industries = requireIndustry ? new Set(requireIndustry.split(",").map((s) => s.trim())) : null;
  // Replace this vertical's existing rows instead of merging into them.
  // The default merge is right for adding a second tag search to a
  // vertical (Machine Learning into artificial-intelligence); it's wrong
  // when a PRIOR import was mis-scoped and needs correcting, since
  // merging would keep the bad rows forever.
  const replace = flags.includes("--replace");
  if (!inputPath || !vertical) {
    console.error("usage: tsx scripts/import-capiq-transactions.ts <path-to-xlsx> <vertical-id> [required-topic-tag-substring] [--industry=A,B] [--replace]");
    process.exit(1);
  }

  const rows: XlsxRow[] = loadCapiqSheet(inputPath);
  const headerRowIdx = rows.findIndex((r) => Object.values(r).includes("SPTR_TARGET_NAME"));
  if (headerRowIdx === -1) throw new Error("SPTR_TARGET_NAME header row not found — export layout may have changed");
  const header = rows[headerRowIdx];
  // Topic Tags has no SPTR_* field code in the main header row — it's only
  // labeled in the super-header row directly above ("Topic Tags\n(Target/
  // Issuer)"), confirmed by hand across both the AI and quantum exports.
  const superHeader = rows[headerRowIdx - 1] ?? {};
  const topicTagsCol = Object.entries(superHeader).find(([, v]) => v?.startsWith("Topic Tags"))?.[0];
  if (requireTag && !topicTagsCol) throw new Error("--required-tag given but no Topic Tags column found in this export");
  const colOptional = (name: string) => Object.entries(header).find(([, v]) => v === name)?.[0];
  const col = (name: string) => {
    const c = colOptional(name);
    if (!c) throw new Error(`column ${name} not found`);
    return c;
  };
  const nameCol = col("SPTR_TARGET_NAME");
  const transactionIdCol = col("SPTR_MI_TRANSACTION_ID");
  // SPTR_ANN_DATE (announcement) is preferred; SPTR_CLOSED_DATE
  // (completion) is the fallback, since some exports carry one and not the
  // other — the biotech raw export has only the closed date, confirmed by
  // hand. A completion date is a real date for the same real transaction,
  // just a later one than the announcement, which beats storing "" and
  // losing the deal from every time-bucketed view.
  const dateCol = colOptional("SPTR_ANN_DATE") ?? colOptional("SPTR_CLOSED_DATE");
  if (!dateCol) console.error("no SPTR_ANN_DATE or SPTR_CLOSED_DATE column in this export — deals will have no date (real limitation, not a bug)");
  else if (!colOptional("SPTR_ANN_DATE")) console.error("no SPTR_ANN_DATE in this export — falling back to SPTR_CLOSED_DATE (completion, not announcement)");
  const typeCol = col("SPTR_TRANSACTION_TYPE");
  const statusCol = col("SPTR_STATUS");
  const valueCol = col("SPTR_TRANSACTION_VALUE");
  const targetIdCol = colOptional("SPTR_TARGET_ID");
  const industryCol = colOptional("SPTR_IQ_TARGET_PRIMARY_INDUSTRY");
  if (industries && !industryCol) throw new Error("--industry given but no SPTR_IQ_TARGET_PRIMARY_INDUSTRY column found in this export");
  // The investor columns carry no SPTR_* code in the main header row (they
  // sit under CapIQ's raw numeric field IDs), so they have to be found
  // some other way. Preferred: the super-header row labels them
  // "Buyers/Investors Name", same place the Topic Tags column is labeled.
  //
  // Fallback, and the reason this got rewritten (2026-09-02): the original
  // implementation took "every column not already claimed above" as an
  // investor column. That held for the AI and quantum exports, where the
  // only unclaimed columns WERE the investor ones — and broke badly on the
  // richer biotech export, which also carries
  // SPTR_IQ_TARGET_PRIMARY_INDUSTRY, SPTR_TARGET_COUNTRY,
  // SPTR_TARGET_BUSINESS_DESCRIPTION, SPTR_IMPLIED_EV, SPTR_CURRENCY_CODE,
  // SPTR_ROUND_TYPE, SPTR_ADVISER_NAME/ROLE and SPTR_DEAL_SUMMARY. Those
  // all landed in `investors`, producing real deals whose investor list
  // read ["NA", "EUR", "Mature", "Adviser Role: ..."]. Keep the label-based
  // path first; the heuristic is only for an export with no super-header.
  const claimed = new Set([nameCol, transactionIdCol, dateCol, typeCol, statusCol, valueCol, targetIdCol].filter((c): c is string => Boolean(c)));
  const labeledInvestorCols = Object.entries(superHeader)
    .filter(([, v]) => v?.startsWith("Buyers/Investors Name"))
    .map(([c]) => c)
    .filter((c) => !claimed.has(c));
  const investorCols = labeledInvestorCols.length > 0
    ? labeledInvestorCols
    : Object.keys(header).filter((c) => !claimed.has(c) && header[c] !== undefined);
  console.log(`investor columns: ${investorCols.join(", ") || "(none)"}${labeledInvestorCols.length > 0 ? " (from super-header label)" : " (fallback: unclaimed columns)"}`);

  const byOrg = new Map<string, VcCompanyFunding>();
  let totalRows = 0;
  let vcRows = 0;
  let tagMatchedRows = 0;
  let industryMatchedRows = 0;
  const droppedIndustries = new Map<string, number>();
  for (const row of rows.slice(headerRowIdx + 3)) {
    const rawName = row[nameCol];
    if (!rawName) continue;
    totalRows++;
    const type = row[typeCol] ?? "";
    if (!VC_TYPE_PREFIXES.some((p) => type.startsWith(p))) continue;
    vcRows++;
    if (requireTag) {
      const tags = topicTagsCol ? row[topicTagsCol] ?? "" : "";
      if (!tags.includes(requireTag)) continue;
      tagMatchedRows++;
    }
    if (industries && industryCol) {
      const ind = row[industryCol] ?? "(none)";
      if (!industries.has(ind)) {
        droppedIndustries.set(ind, (droppedIndustries.get(ind) ?? 0) + 1);
        continue;
      }
      industryMatchedRows++;
    }

    // Real CapIQ entity id wins when present — canonicalizeOrg() still runs
    // for display-name cleanup (legal-suffix stripping) either way, but
    // only becomes the GROUPING key as a fallback for exports without
    // SPTR_TARGET_ID.
    const { id: nameKey, name } = canonicalizeOrg(rawName);
    const rawTargetId = targetIdCol ? row[targetIdCol] : undefined;
    const id = rawTargetId || nameKey;
    const iso = dateCol ? excelDateToIso(row[dateCol] ?? "") : null;
    const rawValue = row[valueCol];
    const amountUsd = rawValue && rawValue !== "NA" && Number.isFinite(Number(rawValue)) ? Math.round(Number(rawValue) * 1e6) : null;
    const investors = investorCols
      .map((c) => row[c])
      .filter((v): v is string => Boolean(v))
      .flatMap((v) => v.split(";").map((s) => s.trim()))
      .filter(Boolean);

    const deal: VcDeal = { dealId: row[transactionIdCol] ?? "", date: iso ?? "", type, status: row[statusCol] ?? "", amountUsd, investors };
    const entry = byOrg.get(id) ?? { orgId: id, name, totalRaisedUsd: 0, dealCount: 0, deals: [] };
    entry.dealCount++;
    if (amountUsd != null) entry.totalRaisedUsd += amountUsd;
    entry.deals.push(deal);
    byOrg.set(id, entry);
  }
  console.log(
    `${totalRows} rows scanned, ${vcRows} matched a real VC/growth financing type` +
    (requireTag ? `, ${tagMatchedRows} also tagged "${requireTag}"` : "") +
    (industries ? `, ${industryMatchedRows} also in industries [${[...industries].join(", ")}]` : "") +
    `, ${byOrg.size} distinct companies after entity consolidation`
  );
  // Print what the industry filter threw away, so a too-narrow filter is
  // visible rather than silently costing real companies.
  if (droppedIndustries.size > 0) {
    const top = [...droppedIndustries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`  dropped by --industry: ${top.map(([k, n]) => `${k} (${n})`).join(", ")}${droppedIndustries.size > 10 ? ", ..." : ""}`);
  }

  // Merge into whatever this vertical already has, rather than replacing
  // it outright — needed for cases like Machine Learning merging into the
  // existing "artificial-intelligence" data (two different tag searches
  // can both surface the same real transaction, e.g. a company tagged
  // both "Artificial Intelligence" and "Machine Learning"). Dedupes by
  // dealId (CapIQ's own transaction id) so the same real round is never
  // double-counted just because two separate exports both contained it.
  const existing = await loadExisting();
  const otherVerticals = existing.filter((e) => (e as any).vertical !== vertical);
  const priorSameVertical = replace ? [] : existing.filter((e) => (e as any).vertical === vertical);
  if (replace) {
    const dropped = existing.filter((e) => (e as any).vertical === vertical).length;
    console.log(`--replace: discarding ${dropped} previously-imported ${vertical} companies rather than merging into them`);
  }

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
    .map((e: any) => {
      const deals = e.deals
        .map((d: VcDeal) => `      { dealId: "${tsLit(d.dealId)}", date: "${tsLit(d.date)}", type: "${tsLit(d.type)}", status: "${tsLit(d.status)}", amountUsd: ${d.amountUsd ?? "null"}, investors: [${d.investors.map((i) => `"${tsLit(i)}"`).join(", ")}] },`)
        .join("\n");
      return `  {
    vertical: "${e.vertical}",
    orgId: "${tsLit(e.orgId)}",
    name: "${tsLit(e.name)}",
    totalRaisedUsd: ${e.totalRaisedUsd},
    dealCount: ${e.dealCount},
    deals: [
${deals}
    ],
  },`;
    })
    .join("\n");

  const file = `// Generated by scripts/import-capiq-transactions.ts from a real S&P
// Capital IQ Pro Transactions export — re-run that script against a fresh
// export to update this file, don't hand-edit it. See CLAUDE.md's "VC
// funding tracking (S&P Capital IQ Transactions)" section. Entities are
// consolidated via entityResolution.ts's canonicalizeOrg() — a real
// heuristic (legal-suffix stripping + a hand-verified alias table), not a
// guaranteed-correct join; this export has no entity-ID column to join on
// instead. Last generated: ${new Date().toISOString()}
import type { VcCompanyFunding } from "../../src/lib/types.ts";

export const CAPIQ_VC_FUNDING: (VcCompanyFunding & { vertical: string })[] = [
${body}
];
`;
  writeFileSync(OUT_PATH, file);
  console.log(`wrote ${combined.length} companies (${forThisVertical.length} for ${vertical}, ${otherVerticals.length} carried over from other verticals) to ${OUT_PATH}`);
}

main();
