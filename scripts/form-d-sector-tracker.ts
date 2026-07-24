// Standalone research script — NOT part of the Global Tech Monitor app's
// build/fetch pipeline (no vertical wiring, not called by fetch-data.ts).
// Pulls SEC EDGAR's real Form D bulk structured datasets (private
// placements under Reg D) and produces a tidy total-raised-by-sector-by-
// quarter CSV to chart elsewhere (R, etc.).
//
// Why the bulk datasets and not full-text search or the submissions API:
// full-text search matching a company name is noisy (checked by hand,
// 2026-07-24 — searching "Anthropic" returned 109 hits, almost all
// secondary-market SPVs referencing the name, not Anthropic's own
// filings), and the submissions API is keyed by CIK, backwards for
// sector-wide discovery. The bulk ZIPs at
// https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets
// (the page moved at some point — the old /dera/data/form-d-data-sets URL
// 404s now, confirmed by hand) contain pre-parsed TSV tables joined on
// ACCESSIONNUMBER: FORMDSUBMISSION, ISSUERS, OFFERING, RECIPIENTS,
// RELATEDPERSONS, SIGNATURES. This script only needs FORMDSUBMISSION and
// OFFERING.
//
// Real caveats this codes around (confirmed against a real downloaded
// quarter, 2025Q4, before writing this):
// - Reg D covers PE/real-estate/hedge funds too, not just startup VC. The
//   OFFERING table's own ISPOOLEDINVESTMENTFUNDTYPE flag (true for 539 of
//   ~14.6k offerings in 2025Q4) is exactly the field to exclude these —
//   used here rather than a synthesized filter.
// - INDUSTRYGROUPTYPE is EDGAR's own coarse sector taxonomy (real values
//   confirmed: "Pooled Investment Fund" dominates by volume, then "Other",
//   "Other Technology", "Other Real Estate", "Commercial", "Biotechnology",
//   "Computers", etc.) — there's no "AI" or "Quantum Computing" tag; the
//   closest tech-relevant buckets are "Other Technology" and "Computers".
//   SECTORS_OF_INTEREST below defaults to those two — edit the array to
//   widen it, the real full list prints to the console on every run so
//   you can see what's available.
// - D/A amendments restate the same offering (same FILE_NUM in
//   FORMDSUBMISSION, confirmed by hand) with updated dollar figures.
//   Deduped by FILE_NUM: the offering is attributed to its EARLIEST
//   filing's quarter (when the raise was actually initiated), using the
//   LATEST amendment's dollar amount (the most current figure) — not the
//   amendment's own filing quarter, which would double-count the same
//   money against two quarters. If an offering's original D fell outside
//   the N quarters pulled, its earliest filing INSIDE the window is used
//   instead — an honest limitation of any windowed pull, not a bug.
// - TOTALOFFERINGAMOUNT is often the literal string "Indefinite" (confirmed
//   real); TOTALAMOUNTSOLD is the actual dollar figure raised and is what
//   this script sums. A TOTALAMOUNTSOLD that isn't a clean number is
//   treated as unknown (excluded from the sum, counted separately) rather
//   than coerced to 0, which would understate real activity.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const SEC_UA = "GlobalTechMonitor research-contact:gtm@example.com";
const DATASETS_PAGE = "https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets";

// Edit this to widen/narrow the sector filter — see the real taxonomy this
// script prints on every run. "Pooled Investment Fund" is always excluded
// separately via ISPOOLEDINVESTMENTFUNDTYPE regardless of this list.
const SECTORS_OF_INTEREST = ["Other Technology", "Computers"];

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../output");

interface TsvTable {
  header: string[];
  colIndex: Map<string, number>;
  rows: string[][];
}

function parseTsv(text: string): TsvTable {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = lines[0].split("\t");
  const colIndex = new Map(header.map((h, i) => [h, i]));
  const rows = lines.slice(1).map((l) => l.split("\t"));
  return { header, colIndex, rows };
}

function col(table: TsvTable, row: string[], name: string): string {
  const i = table.colIndex.get(name);
  if (i === undefined) throw new Error(`column ${name} not found`);
  return (row[i] ?? "").trim();
}

// FORMDSUBMISSION's FILING_DATE is "DD-MON-YYYY" (e.g. "31-DEC-2025"), not
// ISO — confirmed by hand against real 2025Q4 data.
const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};
function parseSecDate(d: string): string | null {
  const m = d.match(/^(\d{2})-([A-Z]{3})-(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1]}`; // ISO YYYY-MM-DD
}

function quarterOf(isoDate: string): string {
  const [y, m] = isoDate.split("-");
  const q = Math.ceil(Number(m) / 3);
  return `${y}Q${q}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": SEC_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function discoverQuarterZips(n: number): Promise<{ label: string; url: string }[]> {
  const html = await fetchText(DATASETS_PAGE);
  // Scrape hrefs rather than hardcode a URL template — the path prefix
  // isn't even stable across quarters (2026q2 uses a different directory
  // than 2025q4 and earlier, confirmed by hand), so a live lookup is the
  // only robust option.
  const hrefs = [...html.matchAll(/href="([^"]*\/(\d{4})q([1-4])_d\.zip)"/g)];
  const seen = new Map<string, { label: string; url: string }>();
  for (const m of hrefs) {
    const [, path, year, q] = m;
    const label = `${year}Q${q}`;
    if (!seen.has(label)) {
      seen.set(label, { label, url: path.startsWith("http") ? path : `https://www.sec.gov${path}` });
    }
  }
  return [...seen.values()]
    .sort((a, b) => (a.label < b.label ? 1 : -1)) // newest first
    .slice(0, n);
}

interface Offering {
  accessionNumber: string;
  fileNum: string;
  filingDate: string; // ISO
  industryGroupType: string;
  isPooledInvestmentFund: boolean;
  totalAmountSold: number | null; // null = present but non-numeric ("unknown")
}

async function loadQuarter(url: string, label: string): Promise<Offering[]> {
  console.log(`fetching ${label} (${url})...`);
  const res = await fetch(url, { headers: { "User-Agent": SEC_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  const findEntry = (name: string) => {
    const e = entries.find((en) => en.entryName.toUpperCase().endsWith(`/${name}`) || en.entryName.toUpperCase() === name);
    if (!e) throw new Error(`${name} not found in ${label}`);
    return e;
  };
  const submissionTable = parseTsv(findEntry("FORMDSUBMISSION.TSV").getData().toString("utf8"));
  const offeringTable = parseTsv(findEntry("OFFERING.TSV").getData().toString("utf8"));

  const submissionByAccession = new Map<string, string[]>();
  for (const row of submissionTable.rows) {
    submissionByAccession.set(col(submissionTable, row, "ACCESSIONNUMBER"), row);
  }

  const out: Offering[] = [];
  for (const row of offeringTable.rows) {
    const accessionNumber = col(offeringTable, row, "ACCESSIONNUMBER");
    const subRow = submissionByAccession.get(accessionNumber);
    if (!subRow) continue; // shouldn't happen — every OFFERING row has a submission
    const filingDateRaw = col(submissionTable, subRow, "FILING_DATE");
    const filingDate = parseSecDate(filingDateRaw);
    if (!filingDate) continue;
    const rawAmount = col(offeringTable, row, "TOTALAMOUNTSOLD");
    const totalAmountSold = /^[0-9.]+$/.test(rawAmount) ? Number(rawAmount) : null;
    out.push({
      accessionNumber,
      fileNum: col(submissionTable, subRow, "FILE_NUM"),
      filingDate,
      industryGroupType: col(offeringTable, row, "INDUSTRYGROUPTYPE"),
      isPooledInvestmentFund: col(offeringTable, row, "ISPOOLEDINVESTMENTFUNDTYPE").toLowerCase() === "true",
      totalAmountSold,
    });
  }
  console.log(`  ${label}: ${out.length} offerings`);
  return out;
}

async function main() {
  const n = Number(process.argv[2] ?? 8);
  console.log(`Discovering the ${n} most recent Form D quarterly datasets...`);
  const quarters = await discoverQuarterZips(n);
  console.log(quarters.map((q) => q.label).join(", "));

  const all: Offering[] = [];
  for (const q of quarters) {
    all.push(...(await loadQuarter(q.url, q.label)));
  }

  const realSectors = new Set(all.map((o) => o.industryGroupType));
  console.log("\nReal INDUSTRYGROUPTYPE values seen in this pull:");
  console.log([...realSectors].sort().join(", "));

  // Exclude pooled-investment-fund filings (VC/PE/hedge/RE funds raising
  // their own fund capital — not operating companies).
  const operating = all.filter((o) => !o.isPooledInvestmentFund);

  // Dedupe D/A amendments: group by FILE_NUM, keep the earliest filing's
  // quarter but the latest filing's dollar amount/sector — see the header
  // comment for why.
  const byFileNum = new Map<string, Offering[]>();
  for (const o of operating) {
    const g = byFileNum.get(o.fileNum) ?? [];
    g.push(o);
    byFileNum.set(o.fileNum, g);
  }
  const deduped: Offering[] = [];
  for (const group of byFileNum.values()) {
    group.sort((a, b) => (a.filingDate < b.filingDate ? -1 : 1));
    const earliest = group[0];
    const latest = group[group.length - 1];
    deduped.push({ ...latest, filingDate: earliest.filingDate, fileNum: earliest.fileNum });
  }

  const filtered = deduped.filter((o) => SECTORS_OF_INTEREST.includes(o.industryGroupType));
  console.log(
    `\n${deduped.length} deduped operating-company offerings total; ` +
    `${filtered.length} match SECTORS_OF_INTEREST (${SECTORS_OF_INTEREST.join(", ")})`
  );

  // Aggregate: total raised + filing count, by sector and quarter.
  const agg = new Map<string, { quarter: string; sector: string; totalRaisedUsd: number; filingCount: number; unknownAmountCount: number }>();
  for (const o of filtered) {
    const quarter = quarterOf(o.filingDate);
    const key = `${quarter}|${o.industryGroupType}`;
    const bucket = agg.get(key) ?? { quarter, sector: o.industryGroupType, totalRaisedUsd: 0, filingCount: 0, unknownAmountCount: 0 };
    bucket.filingCount++;
    if (o.totalAmountSold != null) bucket.totalRaisedUsd += o.totalAmountSold;
    else bucket.unknownAmountCount++;
    agg.set(key, bucket);
  }

  const rows = [...agg.values()].sort((a, b) => (a.quarter < b.quarter ? -1 : a.quarter > b.quarter ? 1 : a.sector < b.sector ? -1 : 1));

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, "form-d-by-sector.csv");
  const csv = [
    "quarter,sector,total_raised_usd,filing_count,unknown_amount_count",
    ...rows.map((r) => `${r.quarter},"${r.sector}",${r.totalRaisedUsd},${r.filingCount},${r.unknownAmountCount}`),
  ].join("\n");
  writeFileSync(outPath, csv);
  console.log(`\nwrote ${rows.length} rows to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
