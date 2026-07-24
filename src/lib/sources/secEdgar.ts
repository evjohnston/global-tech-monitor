// SEC EDGAR XBRL — real, free, no-key corporate financials straight from
// 10-K filings. Used for exactly one signal: total disclosed R&D expense
// per fiscal year, summed across a vertical's tickers (see verticals.ts),
// to pair against the NSF-funded "public investment" trend with a genuine
// "private/corporate investment" one — see DataFile.rdSpend in types.ts for
// why this is kept separate from the NSF-based funding aggregate rather
// than merged into it.
//
// Confirmed by hand (2026-07-24): `us-gaap:ResearchAndDevelopmentExpense`
// resolves cleanly for IonQ, Rigetti, D-Wave, IBM, Alphabet, Honeywell,
// Nvidia, Microsoft, Meta, and Palantir — real, multi-year history in one
// call each (e.g. Nvidia: $8.68B FY2024 -> $12.91B FY2025 -> $18.50B
// FY2026). Amazon returns 404 on this concept — they don't tag a
// standalone R&D line at all, folding it into a broader "technology and
// infrastructure" expense that mixes in non-R&D costs (data-center opex,
// etc.) — so Amazon is skipped rather than force-fit with a mismatched
// number. Whatever other companies get added to a vertical's ticker list
// later may or may not have this exact tag; a 404 here just drops that one
// company from the sum, same soft-fail-per-item pattern as massive.ts.
import type { RdSpendPoint } from "../types.ts";

const SEC_UA = "GlobalTechMonitor research-contact:gtm@example.com";
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const CONCEPT = "ResearchAndDevelopmentExpense";

interface XbrlFact {
  end: string; // YYYY-MM-DD, fiscal period end
  val: number;
  form: string; // "10-K", "10-Q", ...
  fp: string; // "FY", "Q1", ...
}

async function fetchTickerToCik(symbols: string[]): Promise<Map<string, string>> {
  const res = await fetch(TICKERS_URL, { headers: { "User-Agent": SEC_UA } });
  if (!res.ok) throw new Error(`SEC ticker lookup HTTP ${res.status}`);
  const rows = Object.values((await res.json()) as Record<string, { ticker: string; cik_str: number }>);
  const want = new Set(symbols);
  const out = new Map<string, string>();
  for (const r of rows) {
    if (want.has(r.ticker)) out.set(r.ticker, String(r.cik_str).padStart(10, "0"));
  }
  return out;
}

async function fetchOneRdHistory(cik: string): Promise<Map<number, number>> {
  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${CONCEPT}.json`;
  const res = await fetch(url, { headers: { "User-Agent": SEC_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { units?: { USD?: XbrlFact[] } };
  const facts = data.units?.USD ?? [];
  // Annual figures only (10-K, full fiscal year) — 10-Qs report quarterly/
  // YTD subtotals under the same concept, which would double-count against
  // the annual total if included. Dedup by `end` date: the same fiscal
  // year's figure is repeated verbatim across multiple later filings that
  // show it as a comparative prior-year number, not a restatement — keeping
  // one entry per `end` date is correct, not just convenient.
  const byEnd = new Map<string, number>();
  for (const f of facts) {
    if (f.form !== "10-K" || f.fp !== "FY") continue;
    byEnd.set(f.end, f.val);
  }
  const byYear = new Map<number, number>();
  for (const [end, val] of byEnd) byYear.set(Number(end.slice(0, 4)), val);
  return byYear;
}

export async function fetchRdSpendByYear(symbols: string[]): Promise<RdSpendPoint[]> {
  if (symbols.length === 0) return [];
  const cikBySymbol = await fetchTickerToCik(symbols);
  const byYear = new Map<number, RdSpendPoint>();
  for (const symbol of symbols) {
    const cik = cikBySymbol.get(symbol);
    if (!cik) {
      console.error(`sec-edgar: ${symbol} skipped: no CIK found`);
      continue;
    }
    try {
      const history = await fetchOneRdHistory(cik);
      for (const [year, amountUsd] of history) {
        const point = byYear.get(year) ?? { fiscalYear: year, totalUsd: 0, companies: [] };
        point.totalUsd += amountUsd;
        point.companies.push({ symbol, amountUsd });
        byYear.set(year, point);
      }
    } catch (err) {
      console.error(`sec-edgar: ${symbol} skipped:`, (err as Error).message);
    }
  }
  const points = [...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear);
  // Trim only a trailing incomplete tail — a company with a January
  // fiscal-year-end (Nvidia) files its "FY2026" 10-K while calendar-year-end
  // peers are still on "FY2025," which would otherwise show as a
  // cliff-drop total that looks like spending collapsed rather than "one
  // filer is early." This is NOT the same as older years legitimately
  // having fewer companies because some of them didn't exist yet as public
  // filers (IonQ/Rigetti/D-Wave all IPO'd 2021-2022) — that's real history,
  // kept as-is; only the tail gets trimmed, working backward from the most
  // recent year until a fully-covered one is reached.
  const maxCoverage = Math.max(0, ...points.map((p) => p.companies.length));
  while (points.length > 0 && points[points.length - 1].companies.length < maxCoverage) {
    points.pop();
  }
  return points;
}
