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
// SEC hosts more than one XBRL taxonomy and companies tag R&D under more
// than one concept, so trying exactly one of each — which this did until
// 2026-09-02 — silently loses real, free data. Audited every ticker across
// all three verticals that was coming back empty; of 38, thirty had usable
// SEC data under a concept this wasn't asking for:
//   us-gaap:...ExcludingAcquiredInProcessCost  Amgen (51 facts, 2007-2025),
//     Pfizer, AbbVie, Zoetis, Qiagen, 10x Genomics, Teradyne
//   us-gaap:...SoftwareExcludingAcquiredInProcessCost  Adobe (51 facts)
//   ifrs-full:ResearchAndDevelopmentExpense  the 20-F filers — AstraZeneca,
//     Novartis, Legend Biotech, SOPHiA, Bioceres, BioNTech, Sanofi, GSK,
//     Novo Nordisk, Takeda, SAP, TSMC, Nokia, SK Telecom
// Amgen returning 404 on the obvious concept while reporting R&D in every
// annual report is what gave this away. Ordered most- to least-specific;
// the first concept with usable facts wins.
const CONCEPTS: { taxonomy: string; concept: string }[] = [
  { taxonomy: "us-gaap", concept: "ResearchAndDevelopmentExpense" },
  { taxonomy: "us-gaap", concept: "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost" },
  { taxonomy: "us-gaap", concept: "ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost" },
  { taxonomy: "ifrs-full", concept: "ResearchAndDevelopmentExpense" },
];

// USD only, deliberately. Several real filers report R&D in their own
// currency — BioNTech in EUR, GSK in GBP, Novo Nordisk in DKK, Takeda in
// JPY, TSMC in TWD, SK Telecom in KRW — and RdSpendPoint.totalUsd is a SUM
// across companies, so folding a EUR figure in unconverted would produce a
// number that is simply wrong rather than merely imprecise. Converting
// properly needs historical FX at each fiscal-year end, which is a real
// source this app doesn't have. So a non-USD-only filer is skipped and
// logged, the same "omit rather than fabricate" rule used everywhere else
// here. Note several of these ALSO publish a USD series (Alibaba, Baidu,
// TSMC, SAP, Nebius) and those are picked up normally.
const UNIT = "USD";

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

// Annual figures only — 10-Qs report quarterly/YTD subtotals under the same
// concept, which would double-count against the annual total. 20-F is
// accepted alongside 10-K: it's the annual report of a foreign private
// issuer, exactly the filers the ifrs-full concept above exists to reach.
// Some 20-F facts carry an empty or non-"FY" `fp`, so the form is the
// reliable gate and `fp` is only used to exclude explicit quarters.
function annualFactsByYear(facts: XbrlFact[]): Map<number, number> {
  // Dedup by `end` date: the same fiscal year's figure is repeated verbatim
  // across multiple later filings that show it as a comparative prior-year
  // number, not a restatement — one entry per `end` date is correct, not
  // just convenient.
  const byEnd = new Map<string, number>();
  for (const f of facts) {
    const form = f.form ?? "";
    if (!form.startsWith("10-K") && !form.startsWith("20-F")) continue;
    if (f.fp && f.fp !== "FY") continue;
    byEnd.set(f.end, f.val);
  }
  const byYear = new Map<number, number>();
  for (const [end, val] of byEnd) byYear.set(Number(end.slice(0, 4)), val);
  return byYear;
}

async function fetchOneRdHistory(cik: string): Promise<Map<number, number>> {
  let sawNonUsdOnly = false;
  for (const { taxonomy, concept } of CONCEPTS) {
    const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${concept}.json`;
    const res = await fetch(url, { headers: { "User-Agent": SEC_UA } });
    if (!res.ok) continue; // this company doesn't tag this concept — try the next
    const data = (await res.json()) as { units?: Record<string, XbrlFact[]> };
    const units = data.units ?? {};
    const usd = Array.isArray(units[UNIT]) ? annualFactsByYear(units[UNIT]) : new Map<number, number>();
    if (usd.size > 0) return usd;
    // Real data, wrong currency — remember it so the skip message says which
    // problem this is, rather than implying the company reports nothing.
    if (Object.keys(units).some((u) => Array.isArray(units[u]) && annualFactsByYear(units[u]).size > 0)) {
      sawNonUsdOnly = true;
    }
  }
  throw new Error(
    sawNonUsdOnly
      ? `reports R&D only in a non-USD currency — skipped rather than summed into a USD total (see UNIT in secEdgar.ts)`
      : `no usable R&D concept in any taxonomy`
  );
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
        point.companies.push({ symbol, amountUsd, source: "sec" });
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
