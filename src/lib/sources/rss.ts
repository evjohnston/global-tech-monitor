// Live RSS feed for scaling/adoption — the two stages that otherwise have no
// queryable API and were entirely hand-curated (data/<vertical>/seed.ts).
// Runtime-agnostic (global fetch only) so it runs in Node, Workers, and — for
// whichever feed has open CORS — the browser. Feed lists and classifiers are
// per-vertical (see src/lib/verticals.ts); this module is the shared,
// tech-agnostic fetch/parse/classify machinery, checked by hand per vertical
// before any feed is added: each must return valid RSS 2.0 XML from a real,
// actively-publishing trade outlet, not a blog or forum.
//
// Honesty tier: this is the WEAKEST attribution path in the app. Stage and
// country are both a keyword guess against the headline/summary, not a
// verified fact. Every entry gets provenance "auto" (not "live") so the UI
// never implies this is as solid as OpenAlex's institution attribution or a
// hand-verified seed entry. Ambiguous or unclassifiable items are dropped
// rather than guessed into the wrong stage.
import type { Entry, Stage } from "../types.ts";
import { inferInstitutionCountry } from "../institutionCountry.ts";

export interface RssFeedConfig {
  url: string;
  name: string;
  corsOpen: boolean; // confirmed by hand — access-control-allow-origin present
}

// A keyword classifier for one vertical. `relevant` gates topical relevance
// before anything else runs (protects against a general-purpose outlet
// joining a feed list later and polluting results with off-topic items).
// `exclude` defaults to DEFAULT_EXCLUDE_WORDS below (personnel/podcast/
// funding-round noise that isn't specific to any one vertical) — override
// only if a vertical needs something added on top of that baseline.
export interface RssClassifierConfig {
  relevant: RegExp;
  scaling: RegExp;
  adoption: RegExp;
  exclude?: RegExp;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    // Numeric entities (decimal &#8217; and hex &#x2019;) before the &amp;
    // catch-all, since &amp; would otherwise mangle &#038; (ampersand
    // itself, decimal 38) into a double-escaped "&amp;#038;"-shaped mess.
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ") // strip any inline markup in description
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

interface RssItem { title: string; link: string; pubDate: string; description: string }

function parseRssItems(xml: string): RssItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return blocks.map((block) => ({
    title: extractTag(block, "title"),
    link: extractTag(block, "link"),
    pubDate: extractTag(block, "pubDate"),
    description: extractTag(block, "description"),
  }));
}

// Shared noise filter, vertical-agnostic — checked against real quantum feed
// output while building this, and refined against real false positives it
// produced: personnel/hiring news and podcast episodes were both getting
// swept into "adoption" on loose keyword overlap, and VC funding-round
// headlines (money words alone) were getting mistaken for adoption when
// they're really a third kind of story this app doesn't track at all.
// Excluded items are dropped outright, before the stage check — company news
// isn't a milestone in either sense, however it's worded. Every vertical's
// classifier uses this by default (see RssClassifierConfig above); override
// only to add something on top, not to replace it.
export const DEFAULT_EXCLUDE_WORDS =
  /\b(joins|appoints?|appointment|executive\s+(?:leadership|team)|hires?|welcomes\s+\S+\s+as|names?\s+\S+\s+as|who.s\s+news|podcast|webinar|\bepisode\b|profile|interview|op-ed|obituary|raises?\s+(?:US)?\$|seed\s+round|series\s+[a-e]\b|venture\s+capital|conference|summit|symposium|register\s+now|call\s+for\s+papers|complete\s+(?:vendor\s+)?guide|vendor\s+guide|companies\s+\d{4}|^what\s+(?:is|are)\b|\?$)/i;

// Deliberately conservative: an item matching BOTH scaling and adoption
// words, or NEITHER, is dropped rather than assigned to a guessed stage.
// Money words are intentionally NOT a signal on their own (a private funding
// round isn't adoption or investment in this app's sense) — "grant"/"award"
// stay because they mostly show up attached to a genuine government program.
function classifyStage(title: string, description: string, classifier: RssClassifierConfig): Stage | null {
  const text = `${title} ${description}`;
  if (!classifier.relevant.test(text)) return null;
  if ((classifier.exclude ?? DEFAULT_EXCLUDE_WORDS).test(text)) return null;
  const scaling = classifier.scaling.test(text);
  const adoption = classifier.adoption.test(text);
  if (scaling && !adoption) return "scaling";
  if (adoption && !scaling) return "adoption";
  return null; // ambiguous or neither — not a clean fit, drop it
}

function parseDate(pubDate: string): string {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

async function fetchOneFeed(feed: RssFeedConfig, cutoffMs: number, classifier: RssClassifierConfig): Promise<Entry[]> {
  const res = await fetch(feed.url, { headers: { "User-Agent": "GlobalTechMonitor/0.3 (research dashboard)" } });
  if (!res.ok) throw new Error(`${feed.name} HTTP ${res.status}`);
  const items = parseRssItems(await res.text());
  const out: Entry[] = [];
  for (const item of items) {
    const date = parseDate(item.pubDate);
    if (!date || new Date(date).getTime() < cutoffMs) continue;
    const stage = classifyStage(item.title, item.description, classifier);
    if (!stage) continue;
    const { country, evidence } = inferInstitutionCountry(`${item.title} ${item.description}`);
    const idSlug = item.link.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(-70);
    out.push({
      id: `rss-${idSlug}`,
      stage, country, provenance: "auto",
      source: stage === "scaling" ? "milestone" : "deployment",
      title: item.title, org: feed.name, date, url: item.link,
      countryEvidence: `${evidence} (auto-classified from ${feed.name} RSS, unverified)`,
    });
  }
  return out;
}

// Fetches every configured feed for one vertical; one dead/changed feed
// doesn't drop the others (same soft-fail ethos as every other source in
// this app).
export async function fetchNewsRss(
  feeds: RssFeedConfig[],
  classifier: RssClassifierConfig,
  sinceDays = 30
): Promise<Entry[]> {
  const cutoffMs = Date.now() - sinceDays * 864e5;
  const results = await Promise.allSettled(feeds.map((f) => fetchOneFeed(f, cutoffMs, classifier)));
  const out: Entry[] = [];
  for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
  // De-dupe by id in case two outlets syndicate the same story to the same link.
  const byId = new Map<string, Entry>();
  for (const e of out) byId.set(e.id, e);
  return [...byId.values()];
}

// ── Investment-stage news (Google News RSS) ─────────────────────────────
//
// investment stage otherwise has exactly one source (NSF) and exactly one
// real value on every field (source: "grant", provenance: "live") — no news
// layer existed here the way scaling/adoption already had one. Google
// News's own RSS feed license restricts use to "personal, non-commercial"
// feed-reading (confirmed by hand, 2026-07-19, reading the feed's own
// <copyright> tag) — this app is run personally/non-commercially, which is
// why this is Google News rather than GDELT (checked as a legitimately-
// licensed alternative, but the user chose to stay with Google News's
// richer real headlines given that use is covered). Revisit if this project
// is ever deployed publicly/commercially — that license does not cover that.
//
// One request per vertical (not per-feed like fetchNewsRss above) since the
// vertical's whole funding vocabulary is expressed as a single search
// query, not a fixed outlet list.
//
// Known constraint (confirmed 2026-07-19): Google News returns a real,
// content-bearing feed when hit from a residential/dev IP (a local machine
// running `npm run fetch-data`), but returns HTTP 503 when hit from the
// Cloudflare Worker's edge — Google appears to rate-limit or block
// datacenter-IP traffic to this endpoint, consistent with the feed's own
// "personal feed reader" framing. This fails soft like every other source
// here (the Worker route just returns nothing that request), so it isn't a
// crash, but it means the *live* browser-refresh leg of investment news may
// come up empty more often than the nightly `npm run fetch-data` build
// does. Nightly CI runs on GitHub Actions' own datacenter IPs too, so the
// same risk may apply there — watch the "Google News: N items" log line in
// the Action's output before assuming this source is populating reliably.
export interface InvestmentNewsConfig {
  query: string; // Google News search query (their normal search syntax — quotes, OR groups)
  relevant: RegExp; // topical gate — reuse the vertical's existing rssClassifier.relevant
}

function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

// Google's search ranks on the topical term alone, so plenty of results
// mention "AI"/"quantum" without being about funding at all ("National AI
// Appreciation Day," NASA science-data pages) — this second gate, shared
// across verticals, requires actual funding/investment vocabulary before an
// item is considered at all. Checked by hand against real AI/quantum
// queries (2026-07-19).
const FUNDING_RELEVANT =
  /\b(grant|funding|invest(?:s|ment|ing)?|award(?:ed|s)?|appropriat\w*|subsid(?:y|ies)|national\s+(?:ai|quantum|artificial\s+intelligence)\s+(?:strategy|initiative|program|mission))\b/i;

// A funding-keyword search pulls in stock-ticker/investor-advice content
// that isn't investment-stage news in this app's sense (a "buy now" piece
// isn't a government program, and neither is a private funding round —
// same "not investment in this app's sense" logic DEFAULT_EXCLUDE_WORDS
// already applies to VC rounds elsewhere) — checked by hand against real
// quantum and AI queries, the latter noticeably noisier (stock-picking
// content is common AI-news-query filler in a way it isn't for quantum).
const STOCK_NOISE_WORDS =
  /\b(stocks?|shares?|ticker|buy\s+now|sell\s+rating|price\s+target|investors?\s+in|investment\s+(?:opportunity|bubble|moves|advice)|portfolio|\bIPO\b|nasdaq|nyse|earnings\s+(?:call|report)|real\s+estate|best[- ]performing|smartest|money\s+moves|valuation|funding\s+round|raise[sd]?\s+(?:strategic\s+)?funding|returns?\s+(?:on|from)\s+.{0,20}invest)\b/i;

// Google News RSS titles carry " - Outlet Name" appended to the real
// headline — split it so `org` reflects the actual outlet, not a mangled
// headline-plus-outlet string.
function splitGoogleNewsTitle(raw: string): { title: string; org: string } {
  const m = raw.match(/^(.*) - ([^-]+)$/);
  return m ? { title: m[1].trim(), org: m[2].trim() } : { title: raw, org: "" };
}

export async function fetchInvestmentNews(cfg: InvestmentNewsConfig, sinceDays = 30): Promise<Entry[]> {
  const cutoffMs = Date.now() - sinceDays * 864e5;
  const res = await fetch(googleNewsRssUrl(cfg.query), {
    headers: { "User-Agent": "GlobalTechMonitor/0.3 (research dashboard)" },
  });
  if (!res.ok) throw new Error(`Google News RSS HTTP ${res.status}`);
  const items = parseRssItems(await res.text());
  const out: Entry[] = [];
  for (const item of items) {
    const date = parseDate(item.pubDate);
    if (!date || new Date(date).getTime() < cutoffMs) continue;
    const text = `${item.title} ${item.description}`;
    if (!cfg.relevant.test(text)) continue;
    if (!FUNDING_RELEVANT.test(text)) continue;
    if (DEFAULT_EXCLUDE_WORDS.test(text)) continue;
    if (STOCK_NOISE_WORDS.test(text)) continue;
    const { title, org } = splitGoogleNewsTitle(item.title);
    const { country, evidence } = inferInstitutionCountry(text);
    const idSlug = item.link.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(-70);
    out.push({
      id: `gnews-${idSlug}`,
      stage: "investment", country, provenance: "auto", source: "news",
      title, org, date, url: item.link,
      countryEvidence: `${evidence} (auto-classified from Google News RSS, unverified)`,
    });
  }
  const byId = new Map<string, Entry>();
  for (const e of out) byId.set(e.id, e);
  return [...byId.values()];
}
