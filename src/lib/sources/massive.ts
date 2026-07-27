// Massive REST API (api.massive.com) — real-time/historical US-exchange
// market data. Used for exactly one thing here: a per-vertical "public
// markets" panel showing market cap + today's price move for a hand-picked
// list of real, publicly-traded companies materially exposed to that
// vertical (see `tickers` in verticals.ts). Deliberately separate from the
// 4-stage pipeline — a stock price isn't a research/scaling/adoption/
// investment event, it's a standing fact about a company.
//
// Auth/shape confirmed by hand against the real docs (2026-07-24), not
// guessed: `GET /v3/reference/tickers/{ticker}?apiKey=...` returns
// `{status, results: {market_cap, name, homepage_url, ...}}`;
// `GET /v2/snapshot/locale/us/markets/stocks/tickers/{ticker}?apiKey=...`
// returns `{status, ticker: {day: {c}, todaysChangePerc, updated}}` (`c` is
// the latest close price, `updated` a nanosecond epoch timestamp).
import type { CompanySnapshot } from "../types.ts";
import { sleep } from "./util.ts";

const BASE = "https://api.massive.com";

interface TickerOverviewResult {
  market_cap?: number;
  name?: string;
  homepage_url?: string;
}

interface SnapshotTicker {
  day?: { c?: number };
  todaysChangePerc?: number;
  updated?: number; // nanosecond epoch
}

// One ticker's failure (delisted symbol, rate limit, transient error) drops
// just that company rather than the whole panel — same soft-fail ethos as
// every other source here.
async function fetchOne(symbol: string, apiKey: string): Promise<CompanySnapshot | null> {
  try {
    const [ovRes, snapRes] = await Promise.all([
      fetch(`${BASE}/v3/reference/tickers/${symbol}?apiKey=${apiKey}`),
      fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${apiKey}`),
    ]);
    if (!ovRes.ok) throw new Error(`overview HTTP ${ovRes.status}`);
    const ov = ((await ovRes.json()) as { results?: TickerOverviewResult }).results ?? {};
    let snap: SnapshotTicker = {};
    if (snapRes.ok) {
      snap = ((await snapRes.json()) as { ticker?: SnapshotTicker }).ticker ?? {};
    } else {
      // Logged, not thrown — market cap (from the overview call above) is
      // still real and worth keeping even when the snapshot call fails on
      // its own (seen in practice: a plan tier with reference-data access
      // but not real-time quotes returns 403 NOT_AUTHORIZED here). Silently
      // swallowing this would hide a real, ongoing gap in the price/
      // change fields rather than a one-off transient failure.
      console.error(`massive: ${symbol} snapshot HTTP ${snapRes.status} (market cap only, no price/change)`);
    }
    return {
      symbol,
      name: ov.name ?? symbol,
      marketCapUsd: ov.market_cap,
      price: snap.day?.c,
      changePercent: snap.todaysChangePerc,
      asOf: snap.updated ? new Date(snap.updated / 1e6).toISOString() : new Date().toISOString(),
      url: ov.homepage_url ?? `https://api.massive.com/v3/reference/tickers/${symbol}`,
    };
  } catch (err) {
    console.error(`massive: ${symbol} skipped:`, (err as Error).message);
    return null;
  }
}

// Fetched one ticker at a time with a gap between each, not all in
// parallel — confirmed by hand (2026-07-24) that firing every ticker's pair
// of calls at once trips a 429 partway through a 6-ticker vertical (each
// ticker costs 2 calls; a common free-tier stock-API budget is ~5
// calls/minute). This is a background job on a 3-hour cadence, so the
// extra runtime (a few tickers/minute) costs nothing real; a 429 mid-batch
// would otherwise drop companies that had nothing wrong with them.
const TICKER_GAP_MS = 15000;

export async function fetchCompanySnapshots(symbols: string[], apiKey: string): Promise<CompanySnapshot[]> {
  if (!apiKey) throw new Error("MASSIVE_KEY not set");
  const results: (CompanySnapshot | null)[] = [];
  for (let i = 0; i < symbols.length; i++) {
    if (i > 0) await sleep(TICKER_GAP_MS);
    results.push(await fetchOne(symbols[i], apiKey));
  }
  return results.filter((r): r is CompanySnapshot => r !== null);
}
