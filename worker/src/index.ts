// Global Tech Monitor — live-data proxy.
//
// Exists for reasons the browser can't handle on its own:
//   - EPO needs an OAuth client secret, which can never ship in frontend code.
//   - research.gov (NSF Awards) sends no CORS headers, confirmed by hand
//     before building this — a direct browser fetch is silently blocked.
//   - Two of the three quantum-news RSS feeds also send no CORS headers
//     (only thequantuminsider.com does) — proxying all three here keeps the
//     news path in one place instead of a browser/worker hybrid.
//   - Google News RSS (investment-stage funding news) sends no CORS headers
//     either (confirmed by hand) — proxied at /investment-news.
// OpenAlex has neither problem (open CORS, no required secret) and is fetched
// straight from the browser instead — see src/App.tsx.
//
// All source functions are shared with scripts/fetch-data.ts (the nightly
// build) so attribution/classification logic never drifts between the live
// and static paths. Responses are cached at the edge: patents lag ~18
// months and NSF/news move at most a few times a day, so there is no
// honest reason to hit any upstream on every page load.
import { fetchPatents } from "../../src/lib/sources/epo.ts";
import { fetchNSF } from "../../src/lib/sources/nsf.ts";
import { fetchNewsRss, fetchInvestmentNews } from "../../src/lib/sources/rss.ts";
import type { Entry } from "../../src/lib/types.ts";
import { verticalById } from "../../src/lib/verticals.ts";

export interface Env {
  EPO_KEY: string;
  EPO_SECRET: string;
  ALLOWED_ORIGINS: string;
}

// Matches scripts/fetch-data.ts's per-source caps, checked against each
// API's real ceiling (EPO's is a docs claim, untested — no key yet).
const NSF_N = 300; // confirmed working with rpp up to 500, no ceiling hit yet
const EPO_N = 100;
const CACHE_SECONDS = 3600; // an hour — both sources move slowly by nature

function pickOrigin(reqOrigin: string | null, allowedCsv: string): string {
  const allowed = allowedCsv.split(",").map((s) => s.trim()).filter(Boolean);
  if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin;
  return allowed[0] ?? "";
}

function withCors(res: Response, origin: string): Response {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
}

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

async function cached(
  req: Request,
  fetcher: () => Promise<Entry[]>
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(req.url, req);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const entries = await fetcher();
  const res = json(entries, 200, { "Cache-Control": `public, max-age=${CACHE_SECONDS}` });
  await cache.put(cacheKey, res.clone());
  return res;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = pickOrigin(req.headers.get("Origin"), env.ALLOWED_ORIGINS);

    if (req.method === "OPTIONS") {
      return withCors(
        new Response(null, { headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" } }),
        origin
      );
    }
    if (req.method !== "GET") {
      return withCors(json({ error: "method not allowed" }, 405), origin);
    }

    // Defaults to quantum for a bare-URL request (back-compat with the first
    // vertical's existing cached clients); every real caller since the
    // multi-vertical build passes ?vertical=<id> explicitly. Included in the
    // cache key automatically since `cached()` keys off the full request URL.
    const vertical = verticalById(url.searchParams.get("vertical") ?? "quantum-computing");

    try {
      if (url.pathname === "/patents") {
        return withCors(await cached(req, () => fetchPatents(env.EPO_KEY, env.EPO_SECRET, EPO_N, vertical.epoCpcQuery)), origin);
      }
      if (url.pathname === "/funding") {
        return withCors(await cached(req, () => fetchNSF(NSF_N, vertical.fundingKeyword)), origin);
      }
      if (url.pathname === "/news") {
        return withCors(await cached(req, () => fetchNewsRss(vertical.rssFeeds, vertical.rssClassifier, 30)), origin);
      }
      if (url.pathname === "/investment-news") {
        return withCors(
          await cached(req, () =>
            fetchInvestmentNews({ query: vertical.investmentNewsQuery, relevant: vertical.rssClassifier.relevant }, 30)
          ),
          origin
        );
      }
      if (url.pathname === "/" || url.pathname === "/health") {
        return withCors(json({ ok: true, routes: ["/patents", "/funding", "/news", "/investment-news"] }), origin);
      }
      return withCors(json({ error: "not found" }, 404), origin);
    } catch (err) {
      return withCors(json({ error: (err as Error).message }, 502), origin);
    }
  },
} satisfies ExportedHandler<Env>;
