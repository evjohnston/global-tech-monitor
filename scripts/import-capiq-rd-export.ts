// One-time/periodic importer — NOT part of the automated fetch pipeline.
// Parses a manually-exported S&P Capital IQ Pro Excel screen (Companies
// screener, IQ_RD_EXP_FN field, per-company FY columns) and writes the
// derived figures into data/capiq/rd-spend.ts, a plain committed TS file.
//
// Why manual, not automated: Capital IQ's Excel plugin is Windows-only
// (COM add-in), so a Mac user has to use the web-app screener and download
// an .xlsx by hand — there's no key or endpoint this script can call on a
// schedule. Re-run this after a fresh export if the data goes stale.
//
// Why derived-only, not the raw file: S&P's data licensing does not permit
// redistributing raw platform exports (see .gitignore's SPGlobal_Export_*
// pattern) — only the restated numbers below are committed, matching the
// same standard applied to every other real source in this app (only
// facts, never a redistributed proprietary feed).
//
// Confirmed by hand against a real export (2026-07-24): values come back
// in thousands of USD (Samsung's real ~$26-28B/year R&D spend matches the
// raw cell value of ~26,578,187 read as thousands) — multiplied by 1,000
// below to store raw USD, consistent with every other dollar figure in
// this app.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCapiqSheet, type XlsxRow } from "./lib/capiqXlsx.ts";

const OUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../data/capiq/rd-spend.ts");

// CapIQ identifies companies as "Name (EXCHANGE:TICKER)" using its own
// exchange codes, not the US OTC ADR tickers this app's verticals.ts uses
// elsewhere (Massive doesn't recognize CapIQ's native-exchange codes for
// these foreign issuers) — mapped by hand against the real export's
// company list, confirmed against each company's known real ADR ticker.
const CAPIQ_TO_TICKER: Record<string, { symbol: string; name: string }> = {
  "ENXTPA:AIR": { symbol: "EADSY", name: "Airbus SE" },
  "ASX:AXE": { symbol: "ARRXF", name: "Archer Materials Limited" },
  "LSE:BA.": { symbol: "BAESY", name: "BAE Systems plc" },
  "TSE:6702": { symbol: "FJTSY", name: "Fujitsu Limited" },
  "TSE:6503": { symbol: "MIELY", name: "Mitsubishi Electric Corporation" },
  "TSE:6701": { symbol: "NIPNF", name: "NEC Corporation" },
  "TSE:9432": { symbol: "NTTYY", name: "NTT, Inc." },
  "KOSE:A005930": { symbol: "SSNLF", name: "Samsung Electronics Co., Ltd." },
  "TSE:9984": { symbol: "SFTBY", name: "SoftBank Group Corp." },
  "SEHK:700": { symbol: "TCEHY", name: "Tencent Holdings Limited" },
  "ENXTPA:HO": { symbol: "THLLY", name: "Thales S.A." },
  // Added 2026-09-02 from a fresh export, to cover companies SEC EDGAR
  // either can't reach or reports only in a non-USD currency (see the
  // concept/currency notes in sources/secEdgar.ts). Every mapping below is
  // read off that export's own entity-name column, not recalled.
  "TWSE:2330": { symbol: "TSM", name: "Taiwan Semiconductor Manufacturing Company Limited" },
  "TSE:4502": { symbol: "TAK", name: "Takeda Pharmaceutical Company Limited" },
  "LSE:GSK": { symbol: "GSK", name: "GSK plc" },
  "NYSE:BABA": { symbol: "BABA", name: "Alibaba Group Holding Limited" },
  "XTRA:SAP": { symbol: "SAP", name: "SAP SE" },
  "ENXTAM:ASML": { symbol: "ASML", name: "ASML Holding N.V." },
  "NASDAQGS:BIDU": { symbol: "BIDU", name: "Baidu, Inc." },
  "NASDAQGS:BNTX": { symbol: "BNTX", name: "BioNTech SE" },
  "NASDAQGS:NBIS": { symbol: "NBIS", name: "Nebius Group N.V." },
  // US filers that simply don't tag a standalone R&D concept in XBRL, so
  // SEC's companyconcept API returns nothing for them under any of the
  // four concepts secEdgar.ts tries. Different case from the 20-F filers
  // above — not "SEC can't reach them" but "SEC has no machine-readable
  // R&D line for them" — and CapIQ does carry the figure off the financials.
  "NYSE:LHX": { symbol: "LHX", name: "L3Harris Technologies, Inc." },
  "NASDAQCM:NAUT": { symbol: "NAUT", name: "Nautilus Biotechnology, Inc." },
  "NASDAQGM:INOD": { symbol: "INOD", name: "Innodata Inc." },
  "NASDAQGS:RNA": { symbol: "RNA", name: "Atrium Therapeutics, Inc." },
};

// Real ticker-suffix collisions in this export, listed so nobody "helpfully"
// adds them to the map above. A CapIQ code's suffix matching one of this
// app's tickers does NOT mean it's the same company:
//   ASX:SKM   = Skylark Minerals Limited (Australia). This app's SKM is
//               SK Telecom, in quantum's ticker list for quantum
//               networking. Mapping it would file an Australian minerals
//               company's R&D as a Korean telecom's.
//   TSE:7240  = NOK Corporation, a Japanese sealing-parts maker. This app's
//               NOK is Nokia. Same trap.
// Also deliberately NOT mapped: NASDAQGS:AMZN. CapIQ reports $108.5B for
// Amazon FY2025, which is the same blended "technology and infrastructure"
// line SEC exposes and CLAUDE.md already documents as unusable — it mixes
// data-center opex into R&D. Skipping it stays consistent with
// secEdgar.ts's own decision to skip Amazon rather than force-fit a
// mismatched figure.
// Checked against this export and confirmed to carry NO usable R&D figure,
// so they're listed here rather than mapped — a mapping that yields nothing
// implies coverage this app doesn't have, and leaving them unlisted would
// just prompt the next person to re-add them:
//   NYSE:BAH       Booz Allen — 0 non-NA years. A consulting firm doesn't
//                  report an R&D line, at SEC or at CapIQ. A real dead end,
//                  not an oversight.
//   NASDAQCM:ARQQ  Arqit — 0 non-NA years, same as SEC.
//   NYSE:CRL       Charles River — only FY1996/1998/1999, at $1.5M/$1.4M/
//                  $0.5M. That's a pre-IPO entity stub, not the modern
//                  company's real R&D (which is two orders of magnitude
//                  larger and not in this export at all). Importing it
//                  would drop three ~$1M rows into late-1990s fiscal years
//                  where this app has almost nothing else, distorting the
//                  early end of the R&D chart with a fragment. Same
//                  "skip rather than force-fit" rule secEdgar.ts applies to
//                  Amazon.
const KNOWN_COLLISIONS_DO_NOT_MAP = [
  "ASX:SKM", "TSE:7240", "NASDAQGS:AMZN", // wrong company / unusable blended line
  "NYSE:BAH", "NASDAQCM:ARQQ", "NYSE:CRL", // real company, no usable figure
] as const;

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("usage: tsx scripts/import-capiq-rd-export.ts <path-to-xlsx>");
    process.exit(1);
  }
  const rows: XlsxRow[] = loadCapiqSheet(inputPath);

  const headerRowIdx = rows.findIndex((r) => Object.values(r).includes("SP_ENTITY_NAME"));
  if (headerRowIdx === -1) throw new Error("SP_ENTITY_NAME header row not found — export layout may have changed");
  const fyRow = rows[headerRowIdx + 1];
  const yearByCol = new Map<string, number>();
  for (const [col, val] of Object.entries(fyRow)) {
    const m = val?.match(/^FY(\d{4})$/);
    if (m) yearByCol.set(col, Number(m[1]));
  }
  console.log(`found ${yearByCol.size} fiscal-year columns`);

  const nameCol = Object.entries(rows[headerRowIdx]).find(([, v]) => v === "SP_ENTITY_NAME")?.[0];
  if (!nameCol) throw new Error("SP_ENTITY_NAME column letter not found");

  const out: { symbol: string; name: string; fiscalYear: number; amountUsd: number }[] = [];
  let matched = 0;
  let unlistedSkipped = 0;
  const unmappedListed: string[] = [];
  for (const row of rows.slice(headerRowIdx + 2)) {
    const entityName = row[nameCol];
    if (!entityName) continue;
    const exchangeMatch = entityName.match(/\(([^)]+)\)\s*$/);
    const exchangeTicker = exchangeMatch?.[1];
    const mapped = exchangeTicker ? CAPIQ_TO_TICKER[exchangeTicker] : undefined;
    if (!mapped) {
      // A broad CapIQ company search sweeps in thousands of subsidiaries and
      // acquired entities with no listing at all (this export: 5,531 rows,
      // only 106 with a CapIQ exchange code). Logging each one drowns the
      // real signal, so only LISTED companies get a warning — an unlisted
      // subsidiary is expected noise, a listed company that isn't mapped is
      // a decision someone needs to make.
      if (exchangeTicker) {
        const known = (KNOWN_COLLISIONS_DO_NOT_MAP as readonly string[]).includes(exchangeTicker);
        if (!known) unmappedListed.push(`${exchangeTicker}  ${entityName}`);
      } else {
        unlistedSkipped++;
      }
      continue;
    }
    matched++;
    for (const [col, year] of yearByCol) {
      const raw = row[col];
      if (!raw || raw === "NA") continue;
      const thousands = Number(raw);
      if (!Number.isFinite(thousands)) continue;
      out.push({ symbol: mapped.symbol, name: mapped.name, fiscalYear: year, amountUsd: Math.round(thousands * 1000) });
    }
  }
  console.log(`matched ${matched} companies, ${out.length} (company, year) data points`);
  console.log(`skipped ${unlistedSkipped} unlisted rows (subsidiaries/acquired entities with no CapIQ exchange code)`);
  if (unmappedListed.length > 0) {
    console.log(`\n${unmappedListed.length} LISTED companies in this export are not in CAPIQ_TO_TICKER — add any that belong to a vertical:`);
    for (const u of unmappedListed) console.log(`  ${u}`);
  }

  out.sort((a, b) => (a.symbol === b.symbol ? a.fiscalYear - b.fiscalYear : a.symbol < b.symbol ? -1 : 1));
  const body = out
    .map((e) => `  { symbol: "${e.symbol}", name: "${e.name.replace(/"/g, '\\"')}", fiscalYear: ${e.fiscalYear}, amountUsd: ${e.amountUsd} },`)
    .join("\n");
  const file = `// Generated by scripts/import-capiq-rd-export.ts from a real S&P Capital IQ
// Pro export (Companies screener, IQ_RD_EXP_FN field) — re-run that script
// against a fresh export to update this file, don't hand-edit it. See
// CLAUDE.md's "Foreign R&D spend (S&P Capital IQ)" section for why this
// exists: these are 20-F filers SEC EDGAR structurally can't reach.
// Values are real disclosed R&D expense in USD, restated from the
// export's native thousands-of-USD unit. Last generated: ${new Date().toISOString()}
export interface CapiqRdSpendEntry {
  symbol: string;
  name: string;
  fiscalYear: number;
  amountUsd: number;
}

export const CAPIQ_RD_SPEND: CapiqRdSpendEntry[] = [
${body}
];
`;
  writeFileSync(OUT_PATH, file);
  console.log(`wrote ${out.length} entries to ${OUT_PATH}`);
}

main();
