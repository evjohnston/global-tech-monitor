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
    if (snapRes.ok) snap = ((await snapRes.json()) as { ticker?: SnapshotTicker }).ticker ?? {};
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

export async function fetchCompanySnapshots(symbols: string[], apiKey: string): Promise<CompanySnapshot[]> {
  if (!apiKey) throw new Error("MASSIVE_KEY not set");
  const results = await Promise.all(symbols.map((s) => fetchOne(s, apiKey)));
  return results.filter((r): r is CompanySnapshot => r !== null);
}
